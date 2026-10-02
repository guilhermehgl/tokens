import { Request } from "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;   // ID do usuário logado
    userRole?: string; // Role do usuário logado
  }
}
