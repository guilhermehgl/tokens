import test from 'node:test';
import assert from 'node:assert/strict';
import { demoAccounts } from './demoAccounts.js';

test('orientações locais apresentam somente as contas criadas pelo seed', () => {
  const help = demoAccounts('local');
  assert.deepEqual(help.emails, ['admin@demo.local', 'vendedor@demo.local', 'verificador@demo.local']);
  assert.equal(help.password, 'DemoTokens!2026');
  assert.match(help.guidance, /seed/);
  assert.doesNotMatch(JSON.stringify(help), /admin@admin.com|123\$qwer/);
});

test('orientações hospedadas usam contas públicas e explicam o limite dos previews', () => {
  const help = demoAccounts('public');
  assert.deepEqual(help.emails, ['admin@admin.com', 'vendedor@vendedor.com', 'verificador@verificador.com']);
  assert.equal(help.password, '123$qwer');
  assert.match(help.guidance, /atualização do backend/);
  assert.match(help.guidance, /não garantem acesso em previews/);
  assert.doesNotMatch(JSON.stringify(help), /demo.local|DemoTokens!/);
});

test('configuração ausente ou desconhecida não sugere credenciais de outro ambiente', () => {
  for (const value of [undefined, '', 'production', 'preview', 'LOCAL']) {
    const help = demoAccounts(value);
    assert.deepEqual(help.emails, []);
    assert.equal(help.password, undefined);
    assert.match(help.guidance, /não foram definidos/);
    assert.doesNotMatch(JSON.stringify(help), /@|123\$qwer|DemoTokens!/);
  }
});
