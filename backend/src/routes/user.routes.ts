import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getAllUsers, updateUser, deleteUser } from "../controllers/user.controller";
import User from "../models/User";
import bcrypt from "bcrypt";
import { blockDemoUserMutation } from "../middleware/demo";
import { validId, validPassword, persistenceError } from "../utils/validation";
import { isDemoIdentity } from "../demo/accounts";

const router = Router();

// Listar todos os usuários (apenas admin)
router.get("/", authMiddleware(["admin"]), getAllUsers);

// Atualizar usuário (nome, role, senha)
router.put("/:id", authMiddleware(["admin"]), blockDemoUserMutation, updateUser);

// Deletar usuário
router.delete("/:id", authMiddleware(["admin"]), blockDemoUserMutation, deleteUser);


// RESET PASSWORD - apenas admin, não pode resetar senha do próprio admin
router.put("/:id/reset-password", authMiddleware(["admin"]), blockDemoUserMutation, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!validId(id) || !validPassword(newPassword)) return res.status(400).json({ message: "Informe ID válido e senha com 8 caracteres, letra, número e símbolo (até 72 bytes)." });

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (isDemoIdentity(user)) return res.status(403).json({ error: "As credenciais demonstrativas não podem ser alteradas." });

    if (user.role === "admin") return res.status(403).json({ error: "Não é permitido alterar a senha de administradores" });

    // Criptografar senha com bcrypt
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: "Senha alterada com sucesso" });
  } catch (err) {
    persistenceError(res, err);
  }
});



export default router;


