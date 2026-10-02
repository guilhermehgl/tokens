import { Schema, model, Document, Types } from "mongoose";

// Interface para tipagem forte do campo info
export interface IAuditInfo {
  companyId?: Types.ObjectId | string;
  companyName?: string;
  documento?: string;
  tipoDocumento?: string;
  emailReferencia?: string;
  nfNumber?: string;
  tokenId?: string;
  verifiedToken?: string;
  expiresAt?: Date;
  [key: string]: any; // permite outros dados adicionais
}

export interface IAuditLog extends Document {
  action: "CREATE_COMPANY" | "EDIT_COMPANY" | "GENERATE_TOKEN" | "VERIFY_TOKEN" | string;
  performedBy: Types.ObjectId; // Usuário que realizou a ação
  info?: IAuditInfo; // Informações fixas do registro
  targetType?: "Company" | "Token" | string; // Opcional
  createdAt: Date;
  updatedAt: Date;
}

const auditSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    info: { type: Schema.Types.Mixed }, // Salva os dados fixos da ação
    targetType: { type: String }, // opcional
  },
  { timestamps: true }
);

export default model<IAuditLog>("AuditLog", auditSchema);
