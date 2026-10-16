const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
process.env.DOTENV_CONFIG_PATH = require("node:path").join(
  __dirname,
  "no-real-environment.env",
);
process.env.JWT_SECRET = "isolated-security-test-key-000000000000000";
process.env.CORS_ORIGINS = "http://localhost:5173";
const app = require("../dist/src/app").default;
const User = require("../dist/src/models/User").default;
const Token = require("../dist/src/models/Token").default;
const { Company } = require("../dist/src/models/Company");
const Audit = require("../dist/src/models/AuditLog").default;
const { seedDemo } = require("../dist/src/demo/seed");
const { inspectIntegrity } = require("../dist/src/utils/integrity");
const { hashToken } = require("../dist/src/utils/tokenUtils");
test("segurança HTTP e MongoDB temporário", { timeout: 180000 }, async (t) => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("security_demo"));
  await seedDemo();
  await Promise.all([User.init(), Company.init(), Token.init()]);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongo.stop();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const api = async (
    path,
    { token, body, method = body ? "POST" : "GET", headers = {} } = {},
  ) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : { ...{} }),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, headers: r.headers, data: await r.json() };
  };
  const sign = (user) =>
    jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
  const demo = await User.findOne({ email: "admin@demo.local" }),
    seller = await User.findOne({ email: "vendedor@demo.local" }),
    checker = await User.findOne({ email: "verificador@demo.local" });
  const normal = await User.create({
    nome: "Admin Teste",
    email: "admin@example.com",
    password: await bcrypt.hash("TestPass!2026", 10),
    role: "admin",
  });
  const other = await User.create({
    nome: "Pessoa Teste",
    email: "person@example.com",
    password: await bcrypt.hash("TestPass!2026", 10),
    role: "vendedor",
  });
  const adminToken = sign(normal),
    demoToken = sign(demo),
    sellerToken = sign(seller),
    checkToken = sign(checker);
  await t.test("login normaliza e-mail e recusa senha incorreta", async () => {
    assert.equal(
      (
        await api("/auth/login", {
          body: { email: " ADMIN@DEMO.LOCAL ", password: "DemoTokens!2026" },
        })
      ).data.user.isDemo,
      true,
    );
    assert.equal(
      (
        await api("/auth/login", {
          body: { email: "admin@demo.local", password: "wrong" },
        })
      ).status,
      401,
    );
  });
  await t.test(
    "demo bloqueado em todos os endpoints de escrita de usuários comuns",
    async () => {
      for (const [path, method, body] of [
        [
          "/auth/create",
          "POST",
          {
            nome: "Visitante",
            email: "new@example.com",
            password: "TestPass!2026",
            role: "vendedor",
          },
        ],
        ["/users/" + other.id, "PUT", { name: "Changed", role: "admin" }],
        ["/users/" + other.id, "DELETE"],
        [
          "/users/" + other.id + "/reset-password",
          "PUT",
          { newPassword: "TestPass!2027" },
        ],
      ])
        assert.equal(
          (await api(path, { token: demoToken, method, body })).status,
          403,
        );
      assert.equal((await User.findById(other.id)).nome, "Pessoa Teste");
    },
  );
  await t.test(
    "conta publicada legada recebe proteção demo sem alterar o banco hospedado",
    async () => {
      const alias = await User.create({
        nome: "Admin Público",
        email: "admin@admin.com",
        password: normal.password,
        role: "admin",
        isDemo: false,
      });
      const login = await api("/auth/login", {
        body: { email: alias.email, password: "TestPass!2026" },
      });
      assert.equal(login.status, 200);
      assert.equal(login.data.user.isDemo, true);
      assert.equal(
        (
          await api("/users/" + other.id, {
            token: login.data.token,
            method: "DELETE",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api("/users/" + alias.id, {
            token: adminToken,
            method: "PUT",
            body: { name: "Changed" },
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "contas demo protegidas mesmo contra administrador comum e endpoints alternativos",
    async () => {
      for (const [path, method, body] of [
        ["/users/" + seller.id, "PUT", { name: "Changed" }],
        ["/users/" + seller.id, "DELETE"],
        [
          "/users/" + seller.id + "/reset-password",
          "PUT",
          { newPassword: "TestPass!2027" },
        ],
      ])
        assert.equal(
          (await api(path, { token: adminToken, method, body })).status,
          403,
        );
    },
  );
  await t.test(
    "cadastro valida senha, nome, e-mail, perfil e identidade reservada",
    async () => {
      const valid = {
        nome: "Pessoa Teste",
        email: "new@example.com",
        password: "TestPass!2026",
        role: "vendedor",
      };
      for (const change of [
        { nome: " " },
        { email: "bad" },
        { email: "fake@demo.local" },
        { password: "weak" },
        { role: "admin" },
        { role: "other" },
      ])
        assert.equal(
          (
            await api("/auth/create", {
              token: adminToken,
              body: { ...valid, ...change },
            })
          ).status,
          400,
        );
      const created = await api("/auth/create", {
        token: adminToken,
        body: { ...valid, email: " NEW@example.com " },
      });
      assert.equal(created.status, 201);
      assert.equal(created.data.user.email, "new@example.com");
      assert.ok(!JSON.stringify(created.data.user).includes("password"));
      assert.equal(
        (await api("/auth/create", { token: adminToken, body: valid })).status,
        400,
      );
    },
  );
  await t.test(
    "refresh revalida usuário e devolve perfil demo; usuário removido ou perfil trocado invalida sessão",
    async () => {
      const refresh = await api("/auth/refresh-token", {
        token: demoToken,
        body: {},
      });
      assert.equal(refresh.status, 200);
      assert.equal(refresh.data.user.isDemo, true);
      const session = sign(other);
      await User.updateOne(
        { _id: other._id },
        { $set: { role: "verificador" } },
      );
      assert.equal((await api("/companies", { token: session })).status, 401);
      await User.deleteOne({ _id: other._id });
      assert.equal(
        (await api("/auth/refresh-token", { token: session, body: {} })).status,
        401,
      );
      const expired = jwt.sign(
        { id: normal.id, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: -1 },
      );
      assert.equal((await api("/users", { token: expired })).status, 401);
    },
  );
  await t.test(
    "auditoria administrativa sanitizada em toda profundidade e contrato de array preservado",
    async () => {
      await Audit.create({
        action: "LEGACY_TEST",
        performedBy: demo._id,
        info: {
          nfNumber: "000000101",
          token: "secret-plain",
          items: [
            {
              tokenHash: "secret-hash",
              password: "secret-pass",
              authorization: "secret-auth",
              safe: "context",
            },
          ],
        },
      });
      const result = await api("/audit", { token: demoToken });
      assert.equal(result.status, 200);
      assert.ok(Array.isArray(result.data));
      assert.match(JSON.stringify(result.data), /context/);
      assert.doesNotMatch(JSON.stringify(result.data), /secret-/);
      assert.equal(typeof result.data[0]._id, "string");
      assert.equal((await api("/audit", { token: sellerToken })).status, 403);
      assert.equal((await api("/audit")).status, 401);
      assert.doesNotMatch(
        JSON.stringify((await api("/users", { token: demoToken })).data),
        /password|recoveryUUID/,
      );
    },
  );
  const company = await Company.findOne();
  await t.test(
    "empresas: normalização, duplicação, validação, ID inválido e fixtures protegidas",
    async () => {
      const body = {
        razaoSocial: " Empresa Fictícia ",
        documento: "123.456.789-01",
        tipoDocumento: "CPF",
        emailReferencia: " SAMPLE@example.com ",
        telefone: "+12025550123",
      };
      const created = await api("/companies", { token: sellerToken, body });
      assert.equal(created.status, 201);
      assert.equal(created.data.company.documento, "12345678901");
      assert.equal(created.data.company.emailReferencia, "sample@example.com");
      assert.equal(
        (await api("/companies", { token: sellerToken, body })).status,
        409,
      );
      for (const change of [
        { tipoDocumento: "X" },
        { emailReferencia: "invalid" },
        { documento: "abcdefghijk" },
        { telefone: null },
      ])
        assert.equal(
          (
            await api("/companies", {
              token: sellerToken,
              body: { ...body, ...change },
            })
          ).status,
          400,
        );
      assert.equal(
        (
          await api("/companies/bad", {
            token: sellerToken,
            method: "PUT",
            body: { razaoSocial: "Test" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await api("/companies/" + company.id, {
            token: sellerToken,
            method: "PUT",
            body: { razaoSocial: "Changed" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api("/companies/" + created.data.company._id, {
            token: sellerToken,
            method: "PUT",
            body: { emailReferencia: "bad" },
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    "índices únicos reais impedem duplicatas sem sobrescrever",
    async () => {
      await assert.rejects(
        Company.create({
          ...company.toObject(),
          _id: new mongoose.Types.ObjectId(),
        }),
        (error) => error.code === 11000 && !!error.keyPattern.documento,
      );
      const entry = {
        companyId: company._id,
        companyName: company.razaoSocial,
        createdBy: seller._id,
        nfNumber: "000000101",
        expiresAt: new Date(Date.now() + 86400000),
        tokenHash: hashToken("ABC123"),
      };
      await Token.create(entry);
      await assert.rejects(
        Token.create(entry),
        (error) => error.code === 11000 && !!error.keyPattern.tokenHash,
      );
      assert.equal(
        await Token.countDocuments({ tokenHash: entry.tokenHash }),
        1,
      );
      assert.deepEqual(await inspectIntegrity(mongoose.connection.db), {
        tokens: { groups: 0, records: 0 },
        companies: { groups: 0, records: 0 },
        invalidTokenHashes: 0,
        nonCanonicalDocuments: 0,
      });
    },
  );
  await t.test(
    "concorrência real: oito verificações, uma liberação e uma auditoria",
    async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          api("/tokens/verify", {
            token: checkToken,
            body: { token: "ABC123" },
          }),
        ),
      );
      assert.equal(results.filter((r) => r.status === 200).length, 1);
      assert.equal(
        results.filter((r) => r.data.code === "used_token").length,
        7,
      );
      assert.equal(await Audit.countDocuments({ action: "VERIFY_TOKEN" }), 1);
    },
  );
  await t.test(
    "HTTP: CORS explícito, headers, JSON inválido, limite de payload e IP sem confiança em XFF",
    async () => {
      const health = await api("/health");
      assert.equal(health.headers.get("x-content-type-options"), "nosniff");
      assert.ok(health.headers.get("content-security-policy"));
      assert.ok(health.headers.get("referrer-policy"));
      assert.equal(health.headers.get("x-powered-by"), null);
      assert.equal(health.headers.get("strict-transport-security"), null);
      assert.equal(
        (
          await api("/health", {
            headers: { Origin: "https://untrusted.example" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await api("/health", { headers: { Origin: "http://localhost:5173" } })
        ).headers.get("access-control-allow-origin"),
        "http://localhost:5173",
      );
      const bad = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      assert.equal(bad.status, 400);
      assert.equal(
        (
          await api("/auth/login", {
            body: { email: "x".repeat(40000), password: "x" },
          })
        ).status,
        413,
      );
      for (let i = 0; i < 3; i++)
        await api("/auth/login", {
          body: { email: "absent@example.com", password: "wrong" },
          headers: { "X-Forwarded-For": `192.0.2.${i}` },
        });
      const limited = await api("/auth/login", {
        body: { email: "absent@example.com", password: "wrong" },
        headers: { "X-Forwarded-For": "192.0.2.99" },
      });
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers.get("retry-after")) > 0);
    },
  );
  await t.test(
    "seed recusa banco desconhecido mesmo vazio; diagnóstico detecta duplicatas sem expor hashes",
    async () => {
      await mongoose.disconnect();
      await mongoose.connect(mongo.getUri("unknown_database"), {
        autoIndex: false,
      });
      await assert.rejects(seedDemo(), /_demo/);
      assert.equal(
        await mongoose.connection.db.collection("users").countDocuments(),
        0,
      );
      await mongoose.connection.db
        .collection("tokens")
        .insertMany([
          { tokenHash: "secret-hash" },
          { tokenHash: "secret-hash" },
        ]);
      const result = await inspectIntegrity(mongoose.connection.db);
      assert.equal(result.tokens.groups, 1);
      assert.doesNotMatch(JSON.stringify(result), /secret-hash/);
    },
  );
});
