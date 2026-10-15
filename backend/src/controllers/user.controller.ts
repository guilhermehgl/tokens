import { Request, Response } from "express";
import User from "../models/User"; // ajuste se o nome do modelo for diferente
import { validName, validEmail, validPassword, validId, persistenceError } from "../utils/validation";
import bcrypt from "bcrypt";
import { isDemoIdentity } from "../demo/accounts";
import { demoEnabled, testEmail } from "../demo/environment";
import { demoWrite, demoError } from "../demo/quotas";
import { canManageUser } from "../demo/userPolicy";
import { logAction } from "../utils/audit";

// Listar todos os usuários
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, "-password -recoveryUUID").lean(); // não retorna a senha
    res.json(users.map(user => ({ ...user, isDemo: isDemoIdentity(user), canManage: canManageUser(user) })));
  } catch (error) {
    persistenceError(res, error);
  }
};

// Atualizar usuário
export const updateUser = async (req: Request, res: Response) => {
  try {
    const demo = demoEnabled();
    if (req.userIsDemo && !demo) return res.status(403).json({ message: "Operação indisponível para conta demonstrativa." });
    if (demo && ["isDemo", "demoManaged", "active"].some(key => key in req.body)) return res.status(400).json({ message: "Campos de proteção não podem ser alterados." });
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "ID inválido." });
    const { name, role, password } = req.body;
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : req.body.email;
    if ((name !== undefined && !validName(name)) || (email !== undefined && !validEmail(email)) || (password !== undefined && !validPassword(password))) return res.status(400).json({ message: "Nome, e-mail ou senha inválidos." });
    const target = await User.findById(id);
    if (target && !canManageUser(target)) return res.status(403).json({ message: "Esta conta é protegida ou está fora do escopo demonstrativo editável." });
    if (email && isDemoIdentity({ email })) return res.status(400).json({ message: "E-mail reservado para demonstração." });
    if (role !== undefined && !["admin", "vendedor", "verificador"].includes(role)) return res.status(400).json({ message: "Perfil inválido." });
    if (demo && ((email !== undefined && !testEmail(email)) || role === "admin")) return res.status(400).json({ message: "Use perfil vendedor/verificador e e-mail terminado em .test ou .example." });

    const updateData: Record<string, string> = {};
    if (name) updateData.nome = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select("-password -recoveryUUID");

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    if (req.userId) await logAction("EDIT_USER", req.userId, "User", { userId: updatedUser.id, name: updatedUser.nome, role: updatedUser.role });

    res.json({ message: "Usuário atualizado com sucesso", user: updatedUser });
  } catch (error) {
    persistenceError(res, error);
  }
};

// Deletar usuário
export const deleteUser = async (req: Request, res: Response) => {
  try {
    if (req.userIsDemo && !demoEnabled()) return res.status(403).json({ message: "Operação indisponível para conta demonstrativa." });
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "ID inválido." });
    const target = await User.findById(id);
    if (target && !canManageUser(target)) return res.status(403).json({ message: "Esta conta é protegida ou está fora do escopo demonstrativo editável." });
    const deletedUser = await demoWrite("deleteUser", session => User.findByIdAndDelete(id, session ? { session } : {}).exec());

    if (!deletedUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    if (req.userId) await logAction("DELETE_USER", req.userId, "User", { userId: deletedUser.id, name: deletedUser.nome, role: deletedUser.role });

    res.json({ message: "Usuário removido com sucesso" });
  } catch (error) {
    if (demoError(res, error)) return;
    persistenceError(res, error);
  }
};
