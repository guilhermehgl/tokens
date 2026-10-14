import test from "node:test";
import assert from "node:assert/strict";
import { sessionExpiry, validSession, sameSessionUser } from "./session.js";
const jwt = (claims) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
test("sessão exige expiração futura e rejeita JWT malformado", () => {
  assert.equal(validSession("invalid"), false);
  assert.equal(validSession(jwt({})), false);
  assert.equal(validSession(jwt({ exp: "9999999999" })), false);
  assert.equal(validSession(jwt({ exp: 2 }), 2000), false);
  assert.equal(validSession(jwt({ exp: 3 }), 2000), true);
  assert.equal(sessionExpiry(jwt({ exp: 3 })), 3000);
});
test("renovação entre abas preserva a mesma identidade e distingue troca de conta/perfil", () => {
  const old = jwt({ id: "demo", role: "admin", exp: 3 });
  assert.equal(sameSessionUser(old, jwt({ id: "demo", role: "admin", exp: 4 })), true);
  assert.equal(sameSessionUser(old, jwt({ id: "other", role: "admin", exp: 4 })), false);
  assert.equal(sameSessionUser(old, jwt({ id: "demo", role: "vendedor", exp: 4 })), false);
  assert.equal(sameSessionUser(old, "invalid"), false);
  assert.equal(sameSessionUser(jwt({}), jwt({})), false);
});
