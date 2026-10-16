import { Request, Response, NextFunction } from "express";
import { demoEnabled } from "../demo/environment";
export function blockDemoUserMutation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.userIsDemo && !demoEnabled())
    return res
      .status(403)
      .json({
        message:
          "O administrador demonstrativo possui acesso de consulta aos usuários.",
      });
  next();
}
