import { Request, Response } from "express";
import User from "../models/User"; // ajuste se o nome do modelo for diferente
import bcrypt from "bcrypt";
import { isDemoIdentity } from "../demo/accounts";

// Listar todos os usuários
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}, "-password -recoveryUUID"); // não retorna a senha
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar usuários", error });
  }
};

// Atualizar usuário
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    const target = await User.findById(id);
    if (target && isDemoIdentity(target)) return res.status(403).json({ message: "As contas demonstrativas são compartilhadas e não podem ser alteradas." });
    if (email && isDemoIdentity({ email })) return res.status(400).json({ message: "E-mail reservado para demonstração." });
    if (role && !["admin", "vendedor", "verificador"].includes(role)) return res.status(400).json({ message: "Perfil inválido." });

    const updateData: any = {};
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
    res.status(500).json({ message: "Erro ao atualizar usuário", error });
  }
};

// Deletar usuário
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const target = await User.findById(id);
    if (target && isDemoIdentity(target)) return res.status(403).json({ message: "As contas demonstrativas não podem ser removidas." });
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.json({ message: "Usuário removido com sucesso" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao deletar usuário", error });
  }
};
