import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import { Types } from "mongoose";

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
    const { nome, email, password, role } = req.body;

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

    const newUser = await User.create({
      nome,
      email,
      password: hashedPassword,
      role
    });

    const newUserIdStr = (newUser._id as Types.ObjectId).toString();
    const token = generateJWT(newUserIdStr, newUser.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUserIdStr,
        nome: newUser.nome,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro interno" });
  }
};


// ----------------------------
// LOGIN
// ----------------------------

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "E-mail e senha são obrigatórios" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
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
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro interno" });
  }
};

// Rota para renovar token
export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId || !role) {
      return res.status(401).json({ message: "Usuário inválido" });
    }

    const token = jwt.sign({ id: userId, role }, process.env.JWT_SECRET as string, {
      expiresIn: "11h",
    });

    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao renovar token" });
  }
};
