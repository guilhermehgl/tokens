const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const jwt = require('jsonwebtoken');
const { Company } = require('../dist/src/models/Company');
const Token = require('../dist/src/models/Token').default;
const email = require('../dist/src/utils/email');
const audit = require('../dist/src/utils/audit');
const tokenUtils = require('../dist/src/utils/tokenUtils');
const whatsapp = require('../dist/src/services/whatsapp.service');
const { generateToken, verifyToken, deliverToken } = require('../dist/src/controllers/token.controller');

const company = { _id: '507f1f77bcf86cd799439011', razaoSocial: 'Empresa teste', emailReferencia: 'teste@example.com', telefone: '+5531999999999' };
const request = deliveryChannel => ({ body: { companyId: company._id, nfNumber: '123456789', ...(deliveryChannel === undefined ? {} : { deliveryChannel }) }, userId: '507f1f77bcf86cd799439012', userRole: 'vendedor', headers: {}, socket: {}, ip: '127.0.0.1' });
const response = () => ({ code: 200, body: null, setHeader(name, value) { this.headers = { ...this.headers, [name]: value }; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const messageId = '9041058d-93c9-461c-8cd7-2dd1ded7303d';

function dependencies(t, recipient = company) {
  t.mock.method(email, 'validateEmailConfiguration', () => {});
  t.mock.method(Company, 'findById', async () => recipient);
  const persisted = t.mock.method(Token, 'create', async data => ({ ...data, _id: 'saved-token' }));
  const mail = t.mock.method(email, 'sendEmail', async () => {});
  const log = t.mock.method(audit, 'logAction', async () => {});
  const generator = t.mock.method(tokenUtils, 'generateTokenPlain', () => 'A1B2C3');
  const hash = t.mock.method(tokenUtils, 'hashToken', value => require('node:crypto').createHash('sha256').update(value).digest('hex'));
  t.mock.method(whatsapp, 'validateWhatsappConfiguration', () => ({}));
  const send = t.mock.method(whatsapp, 'sendWhatsappText', async () => ({ messageId, status: 'accepted' }));
  t.mock.method(console, 'error', () => {});
  return { persisted, mail, log, generator, hash, send };
}

for (const channel of [undefined, 'screen', 'email', 'whatsapp', 'sms']) {
  test(`Geração retorna código na tela e nunca envia: canal solicitado ${channel}`, async t => {
    const mocked = dependencies(t);
    const res = response();
    await generateToken(request(channel), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.token, 'A1B2C3');
    assert.equal(res.body.deliveryChannel, 'screen');
    assert.equal(res.headers['Cache-Control'], 'no-store');
    for (const fn of [mocked.persisted, mocked.log, mocked.generator, mocked.hash]) assert.equal(fn.mock.callCount(), 1);
    const stored = mocked.persisted.mock.calls[0].arguments[0];
    assert.ok(!JSON.stringify(stored).includes('A1B2C3'));
    assert.ok(!JSON.stringify(mocked.log.mock.calls[0].arguments).includes('A1B2C3'));
    assert.ok(Math.abs(stored.expiresAt.getTime() - Date.now() - 30 * 86400000) < 1000);
    assert.equal(mocked.mail.mock.callCount(), 0);
    assert.equal(mocked.send.mock.callCount(), 0);
  });
}

for (const channel of ['email', 'whatsapp']) {
  test(`Integração preservada: ${channel} com provedor simulado`, async t => {
    const mocked = dependencies(t);
    await deliverToken(company, '123456789', 'A1B2C3', channel);
    assert.equal(mocked.persisted.mock.callCount(), 0);
    assert.equal(mocked.mail.mock.callCount(), channel === 'email' ? 1 : 0);
    assert.equal(mocked.send.mock.callCount(), channel === 'whatsapp' ? 1 : 0);
    if (channel === 'email') assert.match(mocked.mail.mock.calls[0].arguments[2], /A1B2C3/);
    else assert.match(mocked.send.mock.calls[0].arguments[1], /A1B2C3/);
  });
}

test('Serviço HTTP: JWT RS256, normalização, texto e endpoint; sem rede real', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'tokens-vonage-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyFile = join(directory, 'test.key');
  writeFileSync(keyFile, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  for (const [name, value] of Object.entries({ VONAGE_APPLICATION_ID: 'test-application', VONAGE_PRIVATE_KEY_PATH: keyFile, VONAGE_WHATSAPP_FROM: '14157386102', VONAGE_MESSAGES_API_URL: 'https://messages-sandbox.nexmo.com/v1/messages', VONAGE_SANDBOX_RECIPIENT_OVERRIDES: '{}' })) {
    const previous = process.env[name]; process.env[name] = value;
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  const previousImageUrl = process.env.WHATSAPP_TOKEN_IMAGE_URL;
  delete process.env.WHATSAPP_TOKEN_IMAGE_URL;
  t.after(() => { if (previousImageUrl === undefined) delete process.env.WHATSAPP_TOKEN_IMAGE_URL; else process.env.WHATSAPP_TOKEN_IMAGE_URL = previousImageUrl; });
  const fetchMock = t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, process.env.VONAGE_MESSAGES_API_URL);
    assert.equal(options.redirect, 'error');
    const claims = jwt.verify(options.headers.Authorization.slice(7), keys.publicKey, { algorithms: ['RS256'] });
    assert.equal(claims.application_id, 'test-application');
    assert.equal(claims.exp - claims.iat, 300);
    const body = JSON.parse(options.body);
    assert.equal(body.to, '5531999999999');
    assert.equal(body.from, '14157386102');
    assert.equal(body.channel, 'whatsapp');
    assert.equal(body.message_type, 'text');
    assert.equal(body.text, 'Mensagem de teste');
    return { ok: true, status: 202, json: async () => ({ message_uuid: messageId }) };
  });
  assert.deepEqual(await whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste'), { messageId, status: 'accepted' });
  assert.equal(company.telefone, '+5531999999999');
  assert.equal(fetchMock.mock.callCount(), 1);
  process.env.WHATSAPP_TOKEN_IMAGE_URL = 'https://media.example.com/images.jpg';
  fetchMock.mock.mockImplementation(async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.message_type, 'image');
    assert.deepEqual(payload.image, { url: process.env.WHATSAPP_TOKEN_IMAGE_URL, caption: 'Mensagem de teste' });
    assert.equal(payload.text, undefined);
    return { ok: true, status: 202, json: async () => ({ message_uuid: messageId }) };
  });
  await whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste');
  for (const url of ['http://media.example.com/image.jpg', 'https://localhost/image.jpg', 'https://192.168.0.1/image.jpg', 'https://user:password@media.example.com/image.jpg', 'C:/images.jpg']) {
    process.env.WHATSAPP_TOKEN_IMAGE_URL = url;
    assert.throws(whatsapp.validateWhatsappConfiguration, error => error.reason === 'configuration');
  }
  delete process.env.WHATSAPP_TOKEN_IMAGE_URL;
  process.env.VONAGE_SANDBOX_RECIPIENT_OVERRIDES = '{"12025550123":"12025550124"}';
  let actualRecipient;
  fetchMock.mock.mockImplementation(async (_url, options) => {
    actualRecipient = JSON.parse(options.body).to;
    return { ok: true, status: 202, json: async () => ({ message_uuid: messageId }) };
  });
  await whatsapp.sendWhatsappText('+12025550123', 'Mensagem de teste');
  assert.equal(actualRecipient, '12025550124');
  await whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste');
  assert.equal(actualRecipient, '5531999999999');
  process.env.VONAGE_SANDBOX_RECIPIENT_OVERRIDES = 'invalid json';
  const callsBeforeInvalid = fetchMock.mock.callCount();
  await assert.rejects(whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste'), error => error.reason === 'configuration');
  assert.equal(fetchMock.mock.callCount(), callsBeforeInvalid);
  process.env.VONAGE_MESSAGES_API_URL = 'https://api.nexmo.com/v1/messages';
  await whatsapp.sendWhatsappText('+12025550123', 'Mensagem de teste');
  assert.equal(actualRecipient, '12025550123');
  process.env.VONAGE_MESSAGES_API_URL = 'https://messages-sandbox.nexmo.com/v1/messages';
  process.env.VONAGE_SANDBOX_RECIPIENT_OVERRIDES = '{}';
  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 400, json: async () => ({ detail: 'Recipient is not in the sandbox whitelist. secret value' }) }));
  await assert.rejects(whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste'), error => error.reason === 'sandbox_not_allowed' && !error.message.includes('secret value'));
  process.env.VONAGE_MESSAGES_API_URL = 'https://attacker.example/v1/messages';
  assert.throws(whatsapp.validateWhatsappConfiguration, error => error.reason === 'configuration');
});

test('Mapeamento Sandbox exige JSON explícito e identificadores numéricos', () => {
  assert.deepEqual(whatsapp.parseSandboxRecipientOverrides(undefined), {});
  assert.equal(whatsapp.parseSandboxRecipientOverrides('{"12025550123":"12025550124"}')['12025550123'], '12025550124');
  for (const raw of ['null', '[]', 'invalid', '{"__proto__":"12025550124"}', '{"12025550123":"+12025550124"}', '{"12025550123":12025550124}']) {
    assert.throws(() => whatsapp.parseSandboxRecipientOverrides(raw), error => error.reason === 'configuration');
  }
});

test('Classificação amigável de erros sem retornar corpo bruto', () => {
  assert.equal(whatsapp.classifyWhatsappFailure(400, { detail: 'Outside the 24-hour window' }, true).reason, 'window_closed');
  assert.equal(whatsapp.classifyWhatsappFailure(400, { code: 1340 }, true).reason, 'window_closed');
  assert.equal(whatsapp.classifyWhatsappFailure(401, {}, true).reason, 'configuration');
  assert.equal(whatsapp.classifyWhatsappFailure(429, {}, true).reason, 'rate_limit');
  assert.equal(whatsapp.classifyWhatsappFailure(503, {}, true).reason, 'unavailable');
  assert.equal(whatsapp.normalizeWhatsappPhone('+5531999999999'), '5531999999999');
});
test('Verificação distingue inválido, vencido e utilizado sem salvar novamente', async t => {
  t.mock.method(Token, 'findOneAndUpdate', async () => null);
  const lookup = t.mock.method(Token, 'findOne', async () => null);
  for (const [existing, expected] of [[null, 'invalid_token'], [{ used: false, expiresAt: new Date(0) }, 'expired_token'], [{ used: true, expiresAt: new Date(Date.now() + 86400000) }, 'used_token']]) {
    lookup.mock.mockImplementation(async query => 'used' in query ? null : existing);
    const res = response();
    await verifyToken({ ...request(), body: { token: 'A1B2C3' } }, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.code, expected);
  }
});

test('Verificação válida retorna token, cliente, NF e horário e salva uma vez', async t => {
  let saves = 0;
  const document = { companyName: company.razaoSocial, companyId: company._id, nfNumber: '000000011', expiresAt: new Date(Date.now() + 86400000), save: async () => { saves++; } };
  const consume = t.mock.method(Token, 'findOneAndUpdate', async (query, update, options) => {
    assert.equal(query.used, false);
    assert.ok(query.expiresAt.$gt instanceof Date);
    assert.equal(options.new, true);
    Object.assign(document, update.$set);
    return document;
  });
  t.mock.method(Company, 'findById', async () => company);
  const log = t.mock.method(audit, 'logAction', async () => {});
  const res = response();
  await verifyToken({ ...request(), body: { token: 'A1B2C3' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.tokenData.token, 'A1B2C3');
  assert.equal(res.body.tokenData.companyName, company.razaoSocial);
  assert.equal(res.body.tokenData.nfNumber, '000000011');
  assert.ok(res.body.tokenData.usedAt instanceof Date);
  assert.equal(document.used, true);
  assert.equal(saves, 0);
  assert.equal(consume.mock.callCount(), 1);
  assert.equal(log.mock.callCount(), 1);
});

test('Entradas inválidas não consultam nem consomem tokens', async t => {
  const consume = t.mock.method(Token, 'findOneAndUpdate', async () => { throw new Error('Não deve consultar'); });
  for (const token of [undefined, null, {}, [], 123456, 'abc123', 'ABC12', 'ABC1234']) {
    const res = response();
    await verifyToken({ ...request(), body: { token } }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(consume.mock.callCount(), 0);
});

test('Verificações concorrentes: apenas uma liberação e uma auditoria (MongoDB simulado)', async t => {
  const document = { companyName: company.razaoSocial, companyId: company._id, nfNumber: '000000011', used: false, expiresAt: new Date(Date.now() + 86400000) };
  t.mock.method(Token, 'findOneAndUpdate', async (_query, update) => {
    if (document.used) return null;
    Object.assign(document, update.$set);
    return document;
  });
  t.mock.method(Token, 'findOne', async () => document);
  t.mock.method(Company, 'findById', async () => company);
  const log = t.mock.method(audit, 'logAction', async () => {});
  const first = response(); const second = response();
  await Promise.all([verifyToken({ ...request(), body: { token: 'A1B2C3' } }, first), verifyToken({ ...request(), body: { token: 'A1B2C3' } }, second)]);
  assert.deepEqual([first.code, second.code].sort(), [200, 400]);
  assert.equal(second.body.code, 'used_token');
  assert.equal(log.mock.callCount(), 1);
});
