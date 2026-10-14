import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  nome: string;
  email: string;
  password: string;
  role: "admin" | "vendedor" | "verificador";
  isDemo?: boolean;
  recoveryUUID?: string; 
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "vendedor", "verificador"], required: true },
    recoveryUUID: { type: String, default: null }, 
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model<IUser>("User", userSchema);
