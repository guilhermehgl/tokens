process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '465';
process.env.SMTP_USER = 'sender@example.com';
process.env.SMTP_PASS = 'fictional-provider-password';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { sendEmail } = require('../dist/src/utils/email');

test('Utilitário mantém SMTP TLS e argumentos, sem conexão externa', async t => {
  const sent = t.mock.fn(async () => ({ messageId: 'test-message' }));
  const transport = t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: sent }));
  t.mock.method(console, 'log', () => {});
  const attachments = [{ filename: 'logo.png', content: Buffer.from('test'), cid: 'logoEmpresa' }];
  await sendEmail('recipient@example.com', 'Token de Retirada', '<b>A1B2C3</b>', attachments);
  assert.equal(transport.mock.calls[0].arguments[0].secure, true);
  assert.equal(sent.mock.callCount(), 1);
  assert.deepEqual(sent.mock.calls[0].arguments[0], {
    from: process.env.SMTP_USER, to: 'recipient@example.com', subject: 'Token de Retirada',
    html: '<b>A1B2C3</b>', attachments,
  });
});

test('Falha SMTP é propagada sem alegar envio', async t => {
  const failure = new Error('SMTP simulado indisponível');
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => { throw failure; } }));
  t.mock.method(console, 'error', () => {});
  await assert.rejects(sendEmail('recipient@example.com', 'Teste', '<p>Teste</p>'), error => error === failure);
});

test('Nodemailer gera MIME HTML e imagem CID localmente, sem enviar', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const result = await transport.sendMail({
    from: 'sender@example.com', to: 'recipient@example.com', subject: 'Token de Retirada',
    html: '<p>Token: A1B2C3</p><img src="cid:logoEmpresa">',
    attachments: [{ filename: 'logo.png', content: Buffer.from('test'), cid: 'logoEmpresa' }],
  });
  const mime = result.message.toString();
  assert.match(mime, /Content-Type: text\/html/);
  assert.match(mime, /Content-ID: <logoEmpresa>/);
  assert.match(mime, /A1B2C3/);
});
