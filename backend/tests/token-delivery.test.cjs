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
const { generateToken, verifyToken } = require('../dist/src/controllers/token.controller');

const company = { _id: '507f1f77bcf86cd799439011', razaoSocial: 'Empresa teste', emailReferencia: 'teste@example.com', telefone: '+5531999999999' };
const request = deliveryChannel => ({ body: { companyId: company._id, nfNumber: '123456789', ...(deliveryChannel === undefined ? {} : { deliveryChannel }) }, userId: '507f1f77bcf86cd799439012', userRole: 'vendedor', headers: {}, socket: {}, ip: '127.0.0.1' });
const response = () => ({ code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const messageId = '9041058d-93c9-461c-8cd7-2dd1ded7303d';

function dependencies(t, recipient = company) {
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

for (const channel of [undefined, 'email', 'whatsapp']) {
  test(`Uma geração/hash/gravação/auditoria; canal ${channel || 'ausente = email'}`, async t => {
    const mocked = dependencies(t);
    const res = response();
    await generateToken(request(channel), res);
    assert.equal(res.code, 200);
    for (const fn of [mocked.persisted, mocked.log, mocked.generator, mocked.hash]) assert.equal(fn.mock.callCount(), 1);
    const stored = mocked.persisted.mock.calls[0].arguments[0];
    assert.equal(stored.nfNumber, '123456789');
    assert.equal(stored.companyName, company.razaoSocial);
    assert.equal(stored.tokenHash, require('node:crypto').createHash('sha256').update('A1B2C3').digest('hex'));
    assert.ok(Math.abs(stored.expiresAt.getTime() - Date.now() - 30 * 86400000) < 1000);
    assert.ok(!JSON.stringify(stored).includes('A1B2C3'));
    assert.ok(!JSON.stringify(mocked.log.mock.calls[0].arguments).includes('A1B2C3'));
    assert.equal(mocked.log.mock.calls[0].arguments[3].deliveryChannel, channel || 'email');
    if (channel === 'whatsapp') {
      assert.equal(mocked.mail.mock.callCount(), 0);
      assert.equal(mocked.send.mock.callCount(), 1);
      const [to, text] = mocked.send.mock.calls[0].arguments;
      assert.equal(to, company.telefone);
      assert.match(text, /Empresa teste/);
      assert.match(text, /NF: 123456789/);
      assert.match(text, /Token para retirada:\n\*A1B2C3\*/);
      assert.match(text, /Elmaz Caminhões e Ônibus$/);
      assert.match(text, /30 dias a partir da geração/);
      assert.equal(res.body.deliveryStatus, 'accepted');
    } else {
      assert.equal(mocked.send.mock.callCount(), 0);
      assert.equal(mocked.mail.mock.callCount(), 1);
      const [to, subject, html, attachments] = mocked.mail.mock.calls[0].arguments;
      assert.equal(to, company.emailReferencia);
      assert.equal(subject, 'Token de Retirada');
      assert.match(html, /A1B2C3/);
      assert.match(html, /123456789/);
      assert.equal(attachments[0].cid, 'logoEmpresa');
    }
  });
}

test('Empresa antiga: e-mail continua funcionando sem telefone', async t => {
  const mocked = dependencies(t, { ...company, telefone: undefined });
  const res = response();
  await generateToken(request(), res);
  assert.equal(res.code, 200);
  assert.equal(mocked.mail.mock.callCount(), 1);
});

for (const telefone of [undefined, '+5531999', '5531999999999']) {
  test(`Telefone ausente/inválido é rejeitado antes de gerar token (${telefone})`, async t => {
    const mocked = dependencies(t, { ...company, telefone });
    const res = response();
    await generateToken(request('whatsapp'), res);
    assert.equal(res.code, 400);
    assert.equal(res.body.tokenCreated, false);
    assert.equal(mocked.generator.mock.callCount(), 0);
    assert.equal(mocked.persisted.mock.callCount(), 0);
    assert.equal(mocked.send.mock.callCount(), 0);
  });
}

test('Canal inesperado é rejeitado sem gerar/persistir/enviar', async t => {
  const mocked = dependencies(t);
  const res = response();
  await generateToken(request('sms'), res);
  assert.equal(res.code, 400);
  assert.equal(mocked.persisted.mock.callCount(), 0);
});

test('Configuração ausente é rejeitada antes da persistência', async t => {
  const mocked = dependencies(t);
  whatsapp.validateWhatsappConfiguration.mock.mockImplementation(() => { throw new whatsapp.WhatsappDeliveryError('configuration', 'Configuração inválida.', 503); });
  const res = response();
  await generateToken(request('whatsapp'), res);
  assert.equal(res.code, 503);
  assert.equal(mocked.persisted.mock.callCount(), 0);
});

for (const reason of ['sandbox_not_allowed', 'window_closed', 'unavailable']) {
  test(`Falha ${reason}: sem fallback, geração extra ou auditoria duplicada`, async t => {
    const mocked = dependencies(t);
    whatsapp.sendWhatsappText.mock.mockImplementation(async () => { throw new whatsapp.WhatsappDeliveryError(reason, 'Falha amigável.'); });
    const res = response();
    await generateToken(request('whatsapp'), res);
    assert.equal(res.code, 502);
    assert.equal(res.body.tokenCreated, true);
    assert.equal(res.body.code, reason);
    assert.equal(mocked.persisted.mock.callCount(), 1);
    assert.equal(mocked.generator.mock.callCount(), 1);
    assert.equal(mocked.mail.mock.callCount(), 0);
    assert.equal(mocked.log.mock.callCount(), 0);
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
  process.env.VONAGE_SANDBOX_RECIPIENT_OVERRIDES = '{"5531999410646":"553199410646"}';
  let actualRecipient;
  fetchMock.mock.mockImplementation(async (_url, options) => {
    actualRecipient = JSON.parse(options.body).to;
    return { ok: true, status: 202, json: async () => ({ message_uuid: messageId }) };
  });
  await whatsapp.sendWhatsappText('+5531999410646', 'Mensagem de teste');
  assert.equal(actualRecipient, '553199410646');
  await whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste');
  assert.equal(actualRecipient, '5531999999999');
  process.env.VONAGE_SANDBOX_RECIPIENT_OVERRIDES = 'invalid json';
  const callsBeforeInvalid = fetchMock.mock.callCount();
  await assert.rejects(whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste'), error => error.reason === 'configuration');
  assert.equal(fetchMock.mock.callCount(), callsBeforeInvalid);
  process.env.VONAGE_MESSAGES_API_URL = 'https://api.nexmo.com/v1/messages';
  await whatsapp.sendWhatsappText('+5531999410646', 'Mensagem de teste');
  assert.equal(actualRecipient, '5531999410646');
  process.env.VONAGE_MESSAGES_API_URL = 'https://messages-sandbox.nexmo.com/v1/messages';
  process.env.VONAGE_SANDBOX_RECIPIENT_OVERRIDES = '{}';
  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 400, json: async () => ({ detail: 'Recipient is not in the sandbox whitelist. secret value' }) }));
  await assert.rejects(whatsapp.sendWhatsappText(company.telefone, 'Mensagem de teste'), error => error.reason === 'sandbox_not_allowed' && !error.message.includes('secret value'));
  process.env.VONAGE_MESSAGES_API_URL = 'https://attacker.example/v1/messages';
  assert.throws(whatsapp.validateWhatsappConfiguration, error => error.reason === 'configuration');
});

test('Mapeamento Sandbox exige JSON explícito e identificadores numéricos', () => {
  assert.deepEqual(whatsapp.parseSandboxRecipientOverrides(undefined), {});
  assert.equal(whatsapp.parseSandboxRecipientOverrides('{"5531999410646":"553199410646"}')['5531999410646'], '553199410646');
  for (const raw of ['null', '[]', 'invalid', '{"__proto__":"553199410646"}', '{"5531999410646":"+553199410646"}', '{"5531999410646":553199410646}']) {
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
  const document = { companyId: company._id, nfNumber: '000000011', expiresAt: new Date(Date.now() + 86400000), save: async () => { saves++; } };
  t.mock.method(Token, 'findOne', async () => document);
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
  assert.equal(saves, 1);
  assert.equal(log.mock.callCount(), 1);
});
