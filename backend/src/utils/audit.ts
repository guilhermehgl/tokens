import AuditLog, { IAuditLog, IAuditInfo } from "../models/AuditLog";
import { Types } from "mongoose";
import { sanitize } from "./sanitize";

export const logAction = async (
  action: string,
  performedBy: string,
  targetType?: string,
  details?: IAuditInfo
) => {
  try {
    const log: Partial<IAuditLog> = {
      action,
      performedBy: new Types.ObjectId(performedBy),
      targetType,
      info: sanitize(details || {}) as IAuditInfo,
    };

    await AuditLog.create(log);
    return true;
  } catch (error) {
    console.error(JSON.stringify({ event: "AUDIT_WRITE_FAILED", action, targetType }));
    return false;
  }
};
