import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSummary, auditFieldLabel } from './auditPresentation.js';
test('auditoria de usuários mantém resumo legível após exclusão do alvo',()=>{
  for(const action of ['CREATE_USER','EDIT_USER','RESET_USER_PASSWORD','DELETE_USER']) {
    assert.equal(auditSummary({action,info:{name:'Visitante de teste',role:'vendedor',userId:'historical-id'}}),'Visitante de teste · vendedor');
  }
  assert.equal(auditSummary({action:'DELETE_USER',info:{userId:'historical-id'}}),'historical-id');
  assert.equal(auditFieldLabel('userId'),'Identificador do usuário');
});
