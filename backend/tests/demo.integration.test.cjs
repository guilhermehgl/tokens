const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const nodemailer = require('nodemailer');
process.env.DOTENV_CONFIG_PATH = require('node:path').join(__dirname, 'no-real-environment.env');
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.JWT_SECRET = 'isolated-test-signing-key-00000000000000000';
const app = require('../dist/src/app').default;
const { seedDemo } = require('../dist/src/demo/seed');
const { databaseUri, assertRuntime } = require('../dist/src/config/runtime');
const { demoAccounts, demoPassword } = require('../dist/src/demo/accounts');
const User = require('../dist/src/models/User').default;
const { Company } = require('../dist/src/models/Company');
const Token = require('../dist/src/models/Token').default;
const { sendEmail } = require('../dist/src/utils/email');
const { sendWhatsappText } = require('../dist/src/services/whatsapp.service');

test('HTTP: login normal, permissões, token na tela e uso único sem notificações', { timeout: 180000 }, async t => {
  const mongo = await MongoMemoryServer.create();
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  process.env.MONGO_URI = mongo.getUri('portal_tokens_demo');
  assertRuntime();
  await mongoose.connect(databaseUri());
  await seedDemo(); await seedDemo();
  assert.equal(await User.countDocuments(), 3);
  assert.equal(await Company.countDocuments(), 3);
  const smtp = t.mock.method(nodemailer, 'createTransport', () => { throw new Error('Demo não pode criar transporte'); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = global.fetch;
  t.mock.method(global, 'fetch', (url, options) => {
    assert.ok(String(url).startsWith(origin + '/'), 'Conexão externa proibida no teste demo');
    return originalFetch(url, options);
  });
  async function api(path, { token, body, method = body ? 'POST' : 'GET' } = {}) {
    const response = await fetch(origin + '/api' + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  const sessions = {};
  for (const account of demoAccounts) {
    const result = await api('/auth/login', { body: { email: account.email, password: demoPassword } });
    assert.equal(result.status, 200); assert.equal(result.data.user.role, account.role);
    sessions[account.role] = result.data.token;
    assert.notEqual((await User.findOne({ email: account.email })).password, demoPassword);
  }
  assert.equal((await api('/users', { token: sessions.admin })).status, 200);
  assert.equal((await api('/users', { token: sessions.vendedor })).status, 403);
  assert.equal((await api('/companies')).status, 401);
  assert.equal((await api('/tokens/generate', { token: sessions.verificador, body: {} })).status, 403);
  assert.equal((await api('/tokens/verify', { token: sessions.vendedor, body: { token: 'ABC123' } })).status, 403);
  const seller = await User.findOne({ email: 'vendedor@demo.local' });
  assert.equal((await api('/users/' + seller.id, { token: sessions.admin, method: 'DELETE' })).status, 403);
  assert.equal((await api('/users/' + seller.id, { token: sessions.admin, method: 'PUT', body: { role: 'admin' } })).status, 403);
  assert.equal((await api('/users/' + seller.id + '/reset-password', { token: sessions.admin, method: 'PUT', body: { newPassword: 'changed' } })).status, 403);
  const company = await Company.findOne();
  for (const channel of [undefined, 'screen', 'email', 'whatsapp']) {
    await t.test(`contrato HTTP: ${channel ?? 'canal omitido'} sempre retorna na tela`, async () => {
      const result = await api('/tokens/generate', { token: sessions.vendedor, body: {
        companyId: company.id, nfNumber: '000000102',
        ...(channel === undefined ? {} : { deliveryChannel: channel }),
      } });
      assert.equal(result.status, 200);
      assert.equal(result.data.deliveryChannel, 'screen');
      assert.match(result.data.token, /^[A-Z0-9]{6}$/);
      assert.equal(result.headers.get('cache-control'), 'no-store');
      const record = await Token.findById(result.data.tokenId).lean();
      assert.equal(record.used, false);
      assert.equal(record.tokenHash, require('node:crypto').createHash('sha256').update(result.data.token).digest('hex'));
      assert.ok(!JSON.stringify(record).includes(result.data.token));
      const audit = await mongoose.connection.db.collection('auditlogs').find().toArray();
      assert.ok(!JSON.stringify(audit).includes(result.data.token));
      const generations = audit.filter(entry => entry.action === 'GENERATE_TOKEN');
      assert.equal(generations.length, [undefined, 'screen', 'email', 'whatsapp'].indexOf(channel) + 1);
      assert.ok(generations.every(entry => entry.info.deliveryChannel === 'screen'));
      assert.equal(smtp.mock.callCount(), 0);
      // O mock de fetch acima também recusa qualquer conexão com a Vonage.
    });
  }
  const generated = await api('/tokens/generate', { token: sessions.vendedor, body: { companyId: company.id, nfNumber: '000000101', deliveryChannel: 'whatsapp' } });
  assert.equal(generated.status, 200); assert.match(generated.data.token, /^[A-Z0-9]{6}$/);
  assert.equal(generated.headers.get('cache-control'), 'no-store');
  const stored = await Token.findById(generated.data.tokenId).lean();
  assert.ok(!JSON.stringify(stored).includes(generated.data.token));
  assert.ok(Math.abs(new Date(stored.expiresAt) - Date.now() - 30 * 86400000) < 5000);
  const results = await Promise.all([1, 2].map(() => api('/tokens/verify', { token: sessions.verificador, body: { token: generated.data.token } })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal(results.find(r => r.status === 400).data.code, 'used_token');
  assert.ok(!JSON.stringify(await Token.findById(stored._id).lean()).includes(generated.data.token));
  assert.equal((await api('/tokens/verify', { token: sessions.verificador, body: { token: '******' } })).data.code, 'invalid_token');
  const verified = await api('/tokens/verified-today', { token: sessions.verificador });
  assert.ok(!JSON.stringify(verified.data).includes('tokenHash'));
  assert.ok(!JSON.stringify(verified.data).includes(generated.data.token));
  await Token.updateOne({ _id: stored._id }, { $set: { used: false, expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await api('/tokens/verify', { token: sessions.verificador, body: { token: generated.data.token } })).data.code, 'expired_token');
  const entries = await mongoose.connection.db.collection('auditlogs').find().toArray();
  assert.ok(!JSON.stringify(entries).includes(generated.data.token));
  assert.equal(smtp.mock.callCount(), 0);
  // Um banco existente sem marcador nunca é adotado nem limpo pelo seed.
  await mongoose.connection.db.collection('demo_environment').deleteMany({});
  await assert.rejects(seedDemo(), /contém dados/);
  assert.equal(await User.countDocuments(), 3);
});

