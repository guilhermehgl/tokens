import test from "node:test";
import assert from "node:assert/strict";
import { sessionExpiry, validSession } from "./session.js";
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
