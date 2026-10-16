const test = require("node:test");
const assert = require("node:assert/strict");
const { Types } = require("mongoose");
const Token = require("../dist/src/models/Token").default;
const AuditLog = require("../dist/src/models/AuditLog").default;
const utils = require("../dist/src/utils/tokenUtils");
const {
  createUniqueToken,
  MAX_TOKEN_ATTEMPTS,
  TokenCollisionError,
} = require("../dist/src/services/token.service");
const {
  generateToken,
  verifyToken,
} = require("../dist/src/controllers/token.controller");
const { Company } = require("../dist/src/models/Company");
const { sanitize } = require("../dist/src/utils/sanitize");
const { logAction } = require("../dist/src/utils/audit");
const { createMemoryLimiter } = require("../dist/src/middleware/rateLimit");
const {
  validPassword,
  validEmail,
  validName,
} = require("../dist/src/utils/validation");
const { companyInput } = require("../dist/src/utils/companyValidation");
const {
  isDemoIdentity,
  publishedDemoEmails,
} = require("../dist/src/demo/accounts");
const data = {
  companyId: "507f1f77bcf86cd799439011",
  companyName: "Empresa Demo",
  nfNumber: "000000101",
  createdBy: "507f1f77bcf86cd799439012",
  expiresAt: new Date(Date.now() + 86400000),
};
const response = () => ({
  code: 200,
  headers: {},
  status(code) {
    this.code = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  setHeader(k, v) {
    this.headers[k] = v;
  },
});
test("geração criptográfica: formato, número e SHA-256", () => {
  for (let i = 0; i < 1000; i++) {
    const token = utils.generateTokenPlain();
    assert.match(token, /^[A-Z0-9]{6}$/);
    assert.match(token, /\d/);
    assert.match(utils.hashToken(token), /^[a-f0-9]{64}$/);
  }
});
test("colisão: nova tentativa persiste outro hash sem sobrescrever", async (t) => {
  let attempt = 0;
  t.mock.method(utils, "generateTokenPlain", () =>
    ++attempt === 1 ? "ABC123" : "DEF456",
  );
  const create = t.mock.method(Token, "create", async (data) => {
    if (attempt === 1) throw { code: 11000, keyPattern: { tokenHash: 1 } };
    return { ...data, _id: "id" };
  });
  const result = await createUniqueToken(data);
  assert.equal(result.plainToken, "DEF456");
  assert.equal(create.mock.callCount(), 2);
  assert.equal(result.tokenDoc.tokenHash, utils.hashToken("DEF456"));
  assert.ok(!JSON.stringify(result.tokenDoc).includes("DEF456"));
});
test("colisões esgotam limite e HTTP retorna 503 controlado", async (t) => {
  t.mock.method(Token, "create", async () => {
    throw {
      code: 11000,
      keyPattern: { tokenHash: 1 },
      message: "internal-secret",
    };
  });
  const gen = t.mock.method(utils, "generateTokenPlain", () => "ABC123");
  await assert.rejects(createUniqueToken(data), TokenCollisionError);
  assert.equal(gen.mock.callCount(), MAX_TOKEN_ATTEMPTS);
  t.mock.method(Company, "findById", async () => ({
    razaoSocial: data.companyName,
  }));
  t.mock.method(console, "error", () => {});
  const res = response();
  await generateToken(
    { body: data, userId: data.createdBy, userRole: "vendedor" },
    res,
  );
  assert.equal(res.code, 503);
  assert.equal(res.body.tokenCreated, false);
  assert.ok(!JSON.stringify(res.body).includes("internal-secret"));
});
test("erros de banco que não são colisão não são repetidos", async (t) => {
  const create = t.mock.method(Token, "create", async () => {
    throw { code: 11000, keyPattern: { other: 1 } };
  });
  await assert.rejects(createUniqueToken(data));
  assert.equal(create.mock.callCount(), 1);
});
test("sanitização recursiva preserva IDs, datas e contexto", () => {
  const id = new Types.ObjectId(),
    date = new Date();
  assert.deepEqual(
    sanitize({
      _id: id,
      when: date,
      info: {
        tokenId: "id",
        nfNumber: "000000101",
        nested: [
          {
            tokenHash: "hash",
            password: "pass",
            authorization: "Bearer secret",
            JWT: "jwt",
            api_key: "key",
            privateKey: "private",
            verifiedToken: "plain",
            companyName: "Demo",
          },
        ],
      },
    }),
    {
      _id: id.toHexString(),
      when: date,
      info: {
        tokenId: "id",
        nfNumber: "000000101",
        nested: [{ companyName: "Demo" }],
      },
    },
  );
});
test("falha de auditoria é observável sem payload ou erro do banco", async (t) => {
  t.mock.method(AuditLog, "create", async () => {
    throw Error("internal-secret");
  });
  const log = t.mock.method(console, "error", () => {});
  assert.equal(
    await logAction("VERIFY_TOKEN", data.createdBy, "Token", {
      token: "plain-secret",
    }),
    false,
  );
  assert.match(log.mock.calls[0].arguments[0], /AUDIT_WRITE_FAILED/);
  assert.doesNotMatch(
    JSON.stringify(log.mock.calls),
    /internal-secret|plain-secret/,
  );
});
test("auditoria sanitiza também antes da persistência", async (t) => {
  const create = t.mock.method(AuditLog, "create", async () => {});
  assert.equal(
    await logAction("GENERATE_TOKEN", data.createdBy, "Token", {
      nested: [{ password: "s", token: "t", nfNumber: "1" }],
    }),
    true,
  );
  assert.deepEqual(create.mock.calls[0].arguments[0].info, {
    nested: [{ nfNumber: "1" }],
  });
});
test("consumo permanece bem-sucedido com falha de auditoria e sem consulta posterior", async (t) => {
  t.mock.method(Token, "findOneAndUpdate", async () => ({
    ...data,
    used: true,
    usedAt: new Date(),
  }));
  const lookup = t.mock.method(Company, "findById", async () => {
    throw Error("consulta indisponível");
  });
  t.mock.method(AuditLog, "create", async () => {
    throw Error("auditoria indisponível");
  });
  t.mock.method(console, "error", () => {});
  const res = response();
  await verifyToken(
    {
      body: { token: "ABC123" },
      userId: data.createdBy,
      userRole: "verificador",
      ip: "127.0.0.1",
    },
    res,
  );
  assert.equal(res.code, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.tokenData.companyName, data.companyName);
  assert.equal(lookup.mock.callCount(), 0);
});
test("rate limiting: 429, Retry-After, janela, limpeza e capacidade sem evasão", () => {
  let clock = 0,
    passed = 0;
  const limit = createMemoryLimiter(
    2,
    10,
    20,
    (req) => req.ip,
    () => clock,
    2,
  );
  const next = () => passed++;
  try {
    const req = { ip: "a" };
    limit(req, response(), next);
    limit(req, response(), next);
    const blocked = response();
    limit(req, blocked, next);
    assert.equal(blocked.code, 429);
    assert.equal(blocked.headers["Retry-After"], "20");
    clock = 10000;
    const retry = response();
    limit(req, retry, next);
    assert.equal(retry.headers["Retry-After"], "10");
    limit({ ip: "b" }, response(), next);
    const full = response();
    limit({ ip: "c" }, full, next);
    assert.equal(full.code, 429);
    assert.equal(limit.size(), 2);
    clock = 30000;
    limit.sweep();
    assert.equal(limit.size(), 0);
    limit(req, response(), next);
    assert.equal(passed, 4);
  } finally {
    limit.dispose();
  }
});
test("validadores rejeitam tipos incorretos, senhas fracas e truncamento bcrypt", () => {
  for (const value of [
    null,
    {},
    "",
    "abcdefgh",
    "12345678",
    "Abc!1234".repeat(10),
  ])
    assert.equal(validPassword(value), false);
  assert.equal(validPassword("TestPass!2026"), true);
  assert.equal(validEmail(" person@example.com "), true);
  assert.equal(validEmail({}), false);
  assert.equal(validName(" "), false);
});
test("todas as identidades publicadas são demo mesmo sem marcador persistido", () => {
  for (const email of publishedDemoEmails)
    assert.equal(
      isDemoIdentity({ email: " " + email.toUpperCase() + " ", isDemo: false }),
      true,
    );
  assert.equal(isDemoIdentity({ email: "someone@example.com" }), false);
});
test("cadastro normaliza CPF/CNPJ e e-mail sem impor dígitos verificadores", () => {
  const base = {
    razaoSocial: " Demo ",
    documento: "12.345.678/0001-99",
    tipoDocumento: "CNPJ",
    emailReferencia: " TEST@example.com ",
    telefone: "+12025550123",
  };
  const normalized = companyInput(base);
  assert.equal(normalized.documento, "12345678000199");
  assert.equal(normalized.emailReferencia, "test@example.com");
  for (const changed of [
    { tipoDocumento: "OTHER" },
    { documento: "abcdefghijk" },
    { emailReferencia: "invalid" },
    { razaoSocial: [] },
    { telefone: "123" },
  ])
    assert.throws(() => companyInput({ ...base, ...changed }));
});
