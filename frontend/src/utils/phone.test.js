import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneCountries, phoneDigits, formatPhone, phoneE164 } from './phone.js';

test('Brasil: celular, fixo e máscara progressiva', () => {
  assert.equal(formatPhone('31999999999', 'BR'), '(31) 99999-9999');
  assert.equal(formatPhone('3133334444', 'BR'), '(31) 3333-4444');
  assert.equal(phoneE164('31999999999', 'BR'), '+5531999999999');
  assert.equal(phoneE164('3133334444', 'BR'), '+553133334444');
  assert.equal(phoneDigits('(31) 99999-9999abc', 'BR'), '31999999999');
  assert.equal(phoneDigits('+55 31 99999-9999', 'BR'), '31999999999');
});

test('Países e validação internacional', () => {
  assert.ok(phoneCountries.some(item => item.code === 'BR' && item.callingCode === '55'));
  assert.equal(phoneE164('2133734253', 'US'), '+12133734253');
  assert.equal(phoneE164('912345678', 'PT'), '+351912345678');
  assert.equal(phoneE164('31999999999', 'PT'), null);
  assert.equal(phoneE164(phoneDigits('+1 213 373 4253', 'BR'), 'BR'), null);
});

test('Rejeita DDD ausente, número incompleto e comprimentos inválidos', () => {
  for (const value of ['', '999999999', '319999', '319999999999', '0031999999999']) {
    assert.equal(phoneE164(value, 'BR'), null, value);
  }
});
