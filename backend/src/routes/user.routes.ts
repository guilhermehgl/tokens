import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getAllUsers, updateUser, deleteUser } from "../controllers/user.controller";
import User from "../models/User";
import bcrypt from "bcrypt";
import { blockDemoUserMutation } from "../middleware/demo";
import { validId, validPassword, persistenceError } from "../utils/validation";
import { isDemoIdentity } from "../demo/accounts";
import { canManageUser } from "../demo/userPolicy";
import { logAction } from "../utils/audit";
import { demoWrites } from "../middleware/demoWrites";

const router = Router();

// Listar todos os usuários (apenas admin)
router.get("/", authMiddleware(["admin"]), getAllUsers);

// Atualizar usuário (nome, role, senha)
router.put("/:id", authMiddleware(["admin"]), blockDemoUserMutation, demoWrites, updateUser);

// Deletar usuário
router.delete("/:id", authMiddleware(["admin"]), blockDemoUserMutation, demoWrites, deleteUser);


// RESET PASSWORD - apenas admin, não pode resetar senha do próprio admin
router.put("/:id/reset-password", authMiddleware(["admin"]), blockDemoUserMutation, demoWrites, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!validId(id) || !validPassword(newPassword)) return res.status(400).json({ message: "Informe ID válido e senha com 8 caracteres, letra, número e símbolo (até 72 bytes)." });

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!canManageUser(user)) return res.status(403).json({ message: "Esta conta é protegida ou está fora do escopo demonstrativo editável." });

    if (user.role === "admin") return res.status(403).json({ error: "Não é permitido alterar a senha de administradores" });

    // Criptografar senha com bcrypt
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();
    if (req.userId) await logAction("RESET_USER_PASSWORD", req.userId, "User", { userId: user.id, name: user.nome, role: user.role });

    res.json({ message: "Senha alterada com sucesso" });
  } catch (err) {
    persistenceError(res, err);
  }
});



export default router;


