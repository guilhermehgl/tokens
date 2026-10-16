// src/scripts/admin.ts
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import readline from "readline";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { databaseUri, assertRuntime } from "../config/runtime";
import { isDemoIdentity } from "../demo/accounts";
import { validName, validEmail, validPassword } from "../utils/validation";
import User from "../models/User"; // ajuste o caminho se necessário

dotenv.config();

// Conexão com MongoDB
assertRuntime();
mongoose.connect(databaseUri())
  .then(() => console.log("MongoDB conectado"))
  .catch(err => {
    console.error("Erro ao conectar no MongoDB:", err);
    process.exit(1);
  });

// Interface de terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const question = (query: string) => new Promise<string>(resolve => rl.question(query, resolve));

// ----------------------------
// Criar administrador
// ----------------------------
const createAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("Já existe um administrador cadastrado.");
      rl.close();
      process.exit(0);
    }

    const nome = await question("Nome do administrador: ");
    const email = (await question("Email do administrador: ")).trim().toLowerCase();
    const password = await question("Senha do administrador: ");

    if (!validName(nome) || !validEmail(email) || !validPassword(password) || isDemoIdentity({ email })) throw new Error("Dados inválidos ou identidade reservada.");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Gera UUID e hash
    const recoveryUUID = randomUUID();
    const hashedUUID = await bcrypt.hash(recoveryUUID, 10);

    const newAdmin = await User.create({
      nome,
      email,
      password: hashedPassword,
      role: "admin",
      recoveryUUID: hashedUUID
    });

    console.log("Administrador criado com sucesso!");
    console.log("UUID de recuperação (GUARDE OFFLINE!):", recoveryUUID);
    rl.close();
    process.exit(0);
  } catch (err) {
    console.error("Erro ao criar admin:", err);
    rl.close();
    process.exit(1);
  }
};

// ----------------------------
// Alterar senha do administrador
// ----------------------------
const changeAdminPassword = async () => {
  try {
    const email = await question("Email do administrador: ");
    const admin = await User.findOne({ email, role: "admin" });
    if (!admin) {
      console.log("Administrador não encontrado.");
      rl.close();
      process.exit(0);
    }

    const currentPassword = await question("Senha atual: ");
    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) {
      console.log("Senha atual incorreta.");
      rl.close();
      process.exit(0);
    }

    if (isDemoIdentity(admin)) throw new Error("Conta demonstrativa protegida.");
    const newPassword1 = await question("Nova senha: ");
    if (!validPassword(newPassword1)) throw new Error("Senha inválida.");
    const newPassword2 = await question("Confirme a nova senha: ");
    if (newPassword1 !== newPassword2) {
      console.log("As senhas não coincidem.");
      rl.close();
      process.exit(0);
    }

    admin.password = await bcrypt.hash(newPassword1, 10);
    await admin.save();
    console.log("Senha alterada com sucesso!");
    rl.close();
    process.exit(0);
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    rl.close();
    process.exit(1);
  }
};

// ----------------------------
// Recuperar senha via UUID
// ----------------------------
const recoverAdminPassword = async () => {
  try {
    const uuidInput = await question("Informe o UUID de recuperação: ");

    // Busca todos admins e compara hash
    const admins = await User.find({ role: "admin" });
    const admin = admins.find(a => a.recoveryUUID && bcrypt.compareSync(uuidInput, a.recoveryUUID));


    if (!admin) {
      console.log("UUID inválido ou administrador não encontrado.");
      rl.close();
      process.exit(0);
    }

    if (isDemoIdentity(admin)) throw new Error("Conta demonstrativa protegida.");
    const newPassword1 = await question("Nova senha: ");
    if (!validPassword(newPassword1)) throw new Error("Senha inválida.");
    const newPassword2 = await question("Confirme a nova senha: ");
    if (newPassword1 !== newPassword2) {
      console.log("As senhas não coincidem.");
      rl.close();
      process.exit(0);
    }

    admin.password = await bcrypt.hash(newPassword1, 10);
    await admin.save();
    console.log("Senha recuperada com sucesso!");
    rl.close();
    process.exit(0);
  } catch (err) {
    console.error("Erro ao recuperar senha:", err);
    rl.close();
    process.exit(1);
  }
};

// ----------------------------
// Menu principal
// ----------------------------
const menu = async () => {
  console.log("1. Criar administrador");
  console.log("2. Alterar senha do administrador");
  console.log("3. Recuperar senha do administrador via UUID");
  const choice = await question("Escolha uma opção: ");

  if (choice === "1") await createAdmin();
  else if (choice === "2") await changeAdminPassword();
  else if (choice === "3") await recoverAdminPassword();
  else {
    console.log("Opção inválida.");
    rl.close();
    process.exit(0);
  }
};

menu();


//Comando terminal para rodar esse script "npm run admin"
