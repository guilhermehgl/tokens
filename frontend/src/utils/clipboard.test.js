import test from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from './clipboard.js';

function environment(t, clipboard, legacyResult = true) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator; });
  const calls = [];
  const input = { style: {}, setAttribute() {}, focus() { calls.push('focus'); }, select() { calls.push('select'); }, setSelectionRange(start, end) { calls.push([start, end]); }, remove() { calls.push('remove'); } };
  const doc = { activeElement: { focus() { calls.push('restore'); } }, createElement() { return input; }, execCommand(command) { calls.push(command); return legacyResult; } };
  const container = { ownerDocument: doc, appendChild() { calls.push('append'); } };
  return { calls, input, container };
}

test('Copia pela API moderna sem criar campo auxiliar', async t => {
  let copied;
  const env = environment(t, { async writeText(text) { copied = text; } });
  assert.equal(await copyText('BC4NH0', env.container), true);
  assert.equal(copied, 'BC4NH0');
  assert.deepEqual(env.calls, []);
});

for (const [name, clipboard] of [['HTTP sem Clipboard API', undefined], ['permissão negada', { async writeText() { throw new Error('NotAllowedError'); } }]]) {
  test(`Copia por alternativa em ${name}, limpa campo e restaura foco`, async t => {
    const env = environment(t, clipboard);
    assert.equal(await copyText('BC4NH0', env.container), true);
    assert.equal(env.input.value, 'BC4NH0');
    assert.deepEqual(env.calls, ['append', 'focus', 'select', [0, 6], 'copy', 'remove', 'restore']);
  });
}

test('Não informa sucesso quando o navegador recusa ambas as alternativas', async t => {
  const env = environment(t, undefined, false);
  assert.equal(await copyText('BC4NH0', env.container), false);
  assert.deepEqual(env.calls.slice(-2), ['remove', 'restore']);
});
