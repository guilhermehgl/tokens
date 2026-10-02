import AuditLog, { IAuditLog, IAuditInfo } from "../models/AuditLog";
import { Types } from "mongoose";

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
      info: details || {},
    };

    await AuditLog.create(log);
  } catch (error) {
    console.error("Erro ao registrar auditoria:", error);
  }
};
