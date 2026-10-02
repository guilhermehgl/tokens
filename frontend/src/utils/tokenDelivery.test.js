import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPhoneDestination } from './phone.js';

test('Destino de WhatsApp formatado para leitura, sem mudar E.164', () => {
  const stored = '+5531999999999';
  assert.equal(formatPhoneDestination(stored), '+55 (31) 99999-9999');
  assert.equal(stored, '+5531999999999');
  assert.equal(formatPhoneDestination('+12133734253'), '+1 (213) 373-4253');
});

test('Empresas antigas ou com telefone inválido não têm destino WhatsApp disponível', () => {
  for (const value of [undefined, null, '', '31999999999', '+5531999']) assert.equal(formatPhoneDestination(value), '');
});

test('Escolha de canal: destinos, padrão e WhatsApp desabilitado para empresa antiga', async () => {
  const { createServer } = await import('vite');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: DeliveryOptions } = await server.ssrLoadModule('/src/components/TokenDeliveryOptions.jsx');
    const company = { _id: 'test-company', emailReferencia: 'teste@example.com', telefone: '+5531999999999' };
    const render = (recipient, channel = 'email') => renderToStaticMarkup(React.createElement(DeliveryOptions, { company: recipient, channel, onChange() {} }));
    const email = render(company);
    assert.match(email, /teste@example.com/);
    assert.match(email, /\+55 \(31\) 99999-9999/);
    assert.match(email, /checked="" value="email"/);
    assert.match(email, /token-delivery-icon--email/);
    assert.match(email, /token-delivery-icon--whatsapp/);
    assert.match(render(company, 'whatsapp'), /checked="" value="whatsapp"/);
    const legacy = render({ ...company, telefone: undefined });
    assert.match(legacy, /Empresa sem telefone cadastrado/);
    assert.match(legacy.match(/<input[^>]*value="whatsapp"[^>]*>/)[0], /disabled=""/);
  } finally { await server.close(); }
});
