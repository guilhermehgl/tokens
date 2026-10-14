import mongoose from "mongoose";
import { databaseUri } from "./runtime";

export const connectDB = async () => {
  try {
    await mongoose.connect(databaseUri(), { serverSelectionTimeoutMS: 10000, autoIndex: false });
    console.log("MongoDB conectado");
  } catch (error) {
    throw new Error("Não foi possível conectar ao banco configurado. Verifique o modo e a conexão.");
  }
};
