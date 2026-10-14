import { Request, Response } from "express";
import User from "../models/User"; // ajuste se o nome do modelo for diferente
import { validName, validEmail, validPassword, validId, persistenceError } from "../utils/validation";
import bcrypt from "bcrypt";
import { isDemoIdentity } from "../demo/accounts";

// Listar todos os usuários
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, "-password -recoveryUUID").lean(); // não retorna a senha
    res.json(users.map(user => ({ ...user, isDemo: isDemoIdentity(user) })));
  } catch (error) {
    persistenceError(res, error);
  }
};

// Atualizar usuário
export const updateUser = async (req: Request, res: Response) => {
  try {
    if (req.userIsDemo) return res.status(403).json({ message: "Operação indisponível para conta demonstrativa." });
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "ID inválido." });
    const { name, role, password } = req.body;
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : req.body.email;
    if ((name !== undefined && !validName(name)) || (email !== undefined && !validEmail(email)) || (password !== undefined && !validPassword(password))) return res.status(400).json({ message: "Nome, e-mail ou senha inválidos." });
    const target = await User.findById(id);
    if (target && isDemoIdentity(target)) return res.status(403).json({ message: "As contas demonstrativas são compartilhadas e não podem ser alteradas." });
    if (email && isDemoIdentity({ email })) return res.status(400).json({ message: "E-mail reservado para demonstração." });
    if (role !== undefined && !["admin", "vendedor", "verificador"].includes(role)) return res.status(400).json({ message: "Perfil inválido." });

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

    res.json({ message: "Usuário atualizado com sucesso", user: updatedUser });
  } catch (error) {
    persistenceError(res, error);
  }
};

// Deletar usuário
export const deleteUser = async (req: Request, res: Response) => {
  try {
    if (req.userIsDemo) return res.status(403).json({ message: "Operação indisponível para conta demonstrativa." });
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ message: "ID inválido." });
    const target = await User.findById(id);
    if (target && isDemoIdentity(target)) return res.status(403).json({ message: "As contas demonstrativas não podem ser removidas." });
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.json({ message: "Usuário removido com sucesso" });
  } catch (error) {
    persistenceError(res, error);
  }
};
