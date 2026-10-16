const test = require('node:test');
const assert = require('node:assert/strict');
const { Company } = require('../dist/src/models/Company');
const { createCompany, updateCompany, listCompanies } = require('../dist/src/controllers/company.controller');
const { isValidE164 } = require('../dist/src/utils/phone');

const base = { razaoSocial: 'Empresa teste', documento: '12345678000199', tipoDocumento: 'CNPJ', emailReferencia: 'teste@example.com' };
function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('Formato E.164 estrito', () => {
  for (const value of ['+5531999999999', '+553133334444', '+12133734253', '+351912345678']) assert.ok(isValidE164(value));
  for (const value of [undefined, null, '', '(31) 99999-9999', '5531999999999', '+55 (31) 99999-9999', '+5531999']) assert.equal(isValidE164(value), false);
});

test('Schema mantém registros antigos e rejeita telefone inválido', () => {
  assert.equal(new Company(base).validateSync(), undefined);
  assert.equal(new Company({ ...base, telefone: '+5531999999999' }).validateSync(), undefined);
  assert.ok(new Company({ ...base, telefone: '(31) 99999-9999' }).validateSync().errors.telefone);
});

test('Controller: novos cadastros CPF/CNPJ, erros e registros antigos (banco simulado)', async t => {
  let stored;
  t.mock.method(Company, 'findOne', async () => null);
  t.mock.method(Company, 'create', async data => { stored = data; return data; });
  for (const document of [base, { ...base, documento: '12345678901', tipoDocumento: 'CPF' }]) {
    const res = response();
    await createCompany({ body: { ...document, telefone: '+5531999999999' } }, res);
    assert.equal(res.code, 201);
    assert.equal(stored.telefone, '+5531999999999');
    assert.equal(stored.documento, document.documento);
  }
  for (const telefone of [undefined, '(31) 99999-9999', '+5531999']) {
    const res = response();
    await createCompany({ body: { ...base, telefone } }, res);
    assert.equal(res.code, 400);
  }
  for (const tipoDocumento of ['CPF', 'CNPJ']) {
    const res = response();
    await createCompany({ body: { ...base, tipoDocumento, documento: '123', telefone: '+5531999999999' } }, res);
    assert.equal(res.code, 400);
  }
  Company.findOne.mock.mockImplementation(async () => base);
  const duplicate = response();
  await createCompany({ body: { ...base, telefone: '+5531999999999' } }, duplicate);
  assert.equal(duplicate.code, 409);
  assert.equal(duplicate.body.message, 'Empresa já cadastrada.');
  t.mock.method(Company, 'find', () => ({ sort: async () => [base] }));
  const list = response();
  await listCompanies({}, list);
  assert.equal(list.body.companies[0].telefone, undefined);
  t.mock.method(Company, 'findById', async () => base);
  t.mock.method(Company, 'findByIdAndUpdate', async (_id, changes) => ({ ...base, ...changes }));
  const update = response();
  await updateCompany({ params: { id: '507f1f77bcf86cd799439011' }, body: { razaoSocial: 'Novo nome' } }, update);
  assert.equal(update.body.company.razaoSocial, 'Novo nome');
  assert.equal(update.body.company.telefone, undefined);

  const phoneUpdate = response();
  await updateCompany({ params: { id: '507f1f77bcf86cd799439011' }, body: { telefone: '+351912345678' } }, phoneUpdate);
  assert.equal(phoneUpdate.code, 200);
  assert.equal(phoneUpdate.body.company.telefone, '+351912345678');
  assert.equal(Company.findByIdAndUpdate.mock.calls.at(-1).arguments[1].telefone, '+351912345678');
  const callsBeforeInvalid = Company.findByIdAndUpdate.mock.callCount();
  for (const telefone of [null, '', '5531999999999', '(31) 99999-9999', '+5531999']) {
    const invalidUpdate = response();
    await updateCompany({ params: { id: '507f1f77bcf86cd799439011' }, body: { telefone } }, invalidUpdate);
    assert.equal(invalidUpdate.code, 400);
  }
  assert.equal(Company.findByIdAndUpdate.mock.callCount(), callsBeforeInvalid);
});
