declare module "../middleware/auth" {
  import { Request, Response, NextFunction } from "express";

  export function authMiddleware(roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
}
