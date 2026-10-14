// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

// Interface do token decodificado
interface DecodedToken {
  id: string;
  role: string;
  iat: number;
  exp: number;
}

// Extendendo o Request para incluir userId e userRole
declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    userRole?: string;
  }
}

export const authMiddleware = (allowedRoles: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
      const user = await User.findById(decoded.id);
      if (!user || user.role !== decoded.role) return res.status(401).json({ message: "Sessão inválida" });

      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Salva informações do usuário na requisição
      req.userId = decoded.id;
      req.userRole = decoded.role;

      next();
    } catch {
      return res.status(401).json({ message: "Token inválido" });
    }
  };
};
