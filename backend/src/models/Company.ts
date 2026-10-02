import { Schema, model, Types, HydratedDocument } from "mongoose";
import { isValidE164 } from "../utils/phone";

// Interface para tipagem do documento
export interface ICompany {
  _id: Types.ObjectId;
  razaoSocial: string;
  documento: string; // Pode ser CPF ou CNPJ
  tipoDocumento: "CPF" | "CNPJ";
  emailReferencia: string;
  telefone?: string; // Registros antigos podem não ter telefone.
  createdAt: Date;
  updatedAt: Date;
}

// Schema
const CompanySchema = new Schema<ICompany>(
  {
    razaoSocial: { type: String, required: true },
    documento: { type: String, required: true }, // aceita CPF ou CNPJ
    tipoDocumento: {
      type: String,
      enum: ["CPF", "CNPJ"],
      required: true,
    },
    emailReferencia: { type: String, required: true },
    telefone: {
      type: String,
      validate: {
        validator: (value: string | undefined) => value === undefined || isValidE164(value),
        message: "Informe um telefone válido no formato internacional.",
      },
    },
  },
  { timestamps: true }
);

// Tipagem do documento
export type CompanyDocument = HydratedDocument<ICompany>;

// Named export do model
export const Company = model<ICompany>("Company", CompanySchema);
