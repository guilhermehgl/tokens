import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  companyName: { type: String, required: true }, 
  tokenHash: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  nfNumber: { type: String, required: true },
  usedAt: { type: Date },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Token", tokenSchema);
