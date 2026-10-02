const API_URL = import.meta.env.VITE_API_URL + "/auth";

export async function loginUser(email, password) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Credenciais inválidas");
  }

  return await response.json(); // { token, role }
}
