import { Request, Response, NextFunction } from "express";
export function blockDemoUserMutation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.userIsDemo)
    return res
      .status(403)
      .json({
        message:
          "O administrador demonstrativo possui acesso de consulta aos usuários.",
      });
  next();
}
