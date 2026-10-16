import { isDemoIdentity, isProtectedDemoAccount } from "./accounts";
import { demoEnabled } from "./environment";

export function canManageUser(target: { email?: string; isDemo?: boolean; demoManaged?: boolean; role?: string }) {
  if (isProtectedDemoAccount(target)) return false;
  if (demoEnabled()) return target.demoManaged === true && target.role !== "admin";
  return !isDemoIdentity(target);
}
