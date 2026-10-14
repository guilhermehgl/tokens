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
