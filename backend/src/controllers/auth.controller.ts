import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { Types } from "mongoose";
import { validEmail, validName, validPassword, persistenceError } from "../utils/validation";
import { isDemoIdentity } from "../demo/accounts";
import { demoEnabled, testEmail } from "../demo/environment";
import { demoWrite, demoError } from "../demo/quotas";
import { logAction } from "../utils/audit";

// Função para gerar JWT
const generateJWT = (id: string, role: string): string => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, { expiresIn: "11h" });
};

// Tipagem para Request com usuário
interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

// ----------------------------
// REGISTER
// ----------------------------
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nome, password, role } = req.body;
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : req.body.email;
    const demo = demoEnabled();
    if (req.userIsDemo && !demo) { res.status(403).json({ message: "Operação indisponível para conta demonstrativa." }); return; }
    if (demo && ["isDemo", "demoManaged", "active"].some(key => key in req.body)) { res.status(400).json({ message: "Campos de proteção não podem ser definidos pelo cliente." }); return; }
    if (!validName(nome) || !validEmail(email) || !validPassword(password)) { res.status(400).json({ message: "Informe nome, e-mail válido e senha com 8 caracteres, letra, número e símbolo (até 72 bytes)." }); return; }
    if (typeof email !== "string" || isDemoIdentity({ email }) || !["vendedor", "verificador"].includes(role)) {
      res.status(400).json({ message: "Informe um perfil permitido e um e-mail não reservado." }); return;
    }
    if (demo && !testEmail(email)) { res.status(400).json({ code: "demo_test_email_required", message: "Use um e-mail fictício terminado em .test ou .example." }); return; }

    if (!nome || !email || !password || !role) {
      res.status(400).json({ message: "Todos os campos são obrigatórios" });
      return;
    }

    // ❌ Bloquear criação de admins via rota pública
    if (role === "admin") {
      res.status(403).json({ message: "Não é permitido criar administradores via esta rota" });
      return;
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400).json({ message: "E-mail já cadastrado" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const data = {
      nome,
      email,
      password: hashedPassword,
      role, ...(demo ? { isDemo: true, demoManaged: true } : {})
    };
    const newUser = await demoWrite("users", async session => session ? (await User.create([data], { session }))[0] : await User.create(data));
    if (req.userId) await logAction("CREATE_USER", req.userId, "User", { userId: newUser.id, name: newUser.nome, role: newUser.role });

    const newUserIdStr = (newUser._id as Types.ObjectId).toString();
    const token = generateJWT(newUserIdStr, newUser.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUserIdStr,
        nome: newUser.nome,
        email: newUser.email,
        role: newUser.role, isDemo: demo || isDemoIdentity(newUser), demoEnvironment: demo
      }
    });
  } catch (error) {
    if (demoError(res, error)) return;
    persistenceError(res, error);
  }
};


// ----------------------------
// LOGIN
// ----------------------------

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(401).json({ message: "Usuário ou senha inválidos" }); return;
    }

    if (!email || !password) {
      res.status(400).json({ message: "E-mail e senha são obrigatórios" });
      return;
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.active === false) {
      res.status(401).json({ message: "Usuário ou senha inválidos" });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({ message: "Usuário ou senha inválidos" });
      return;
    }

    const userIdStr = (user._id as Types.ObjectId).toString();
    const token = generateJWT(userIdStr, user.role);

    res.json({
      success: true,
      token,
      user: {
        id: userIdStr,
        nome: user.nome,
        email: user.email,
        role: user.role, isDemo: demoEnabled() || isDemoIdentity(user), demoEnvironment: demoEnabled()
      }
    });
  } catch (error) {
    persistenceError(res, error);
  }
};

// Rota para renovar token
export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const role = req.userRole;

    if (!userId || !role) {
      return res.status(401).json({ message: "Usuário inválido" });
    }

    const user = await User.findById(userId);
    if (!user || user.active === false || user.role !== role) return res.status(401).json({ message: "Sessão inválida" });
    const token = generateJWT(userId, user.role);
    res.json({ success: true, token, user: { id: userId, nome: user.nome, email: user.email, role: user.role, isDemo: demoEnabled() || isDemoIdentity(user), demoEnvironment: demoEnabled() } });
  } catch (err) {
    console.error("SESSION_REFRESH_FAILED");
    res.status(500).json({ message: "Erro ao renovar token" });
  }
};
