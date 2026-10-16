import { jwtDecode } from "jwt-decode";
export function sessionExpiry(token) {
  try {
    const { exp } = jwtDecode(token);
    return Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}
export const validSession = (token, now = Date.now()) =>
  sessionExpiry(token) > now;
export function sameSessionUser(first, second) {
  try {
    const a = jwtDecode(first), b = jwtDecode(second);
    return typeof a.id === "string" && Boolean(a.id) && a.id === b.id &&
      a.role === b.role && ["admin", "vendedor", "verificador"].includes(a.role);
  } catch { return false; }
}
