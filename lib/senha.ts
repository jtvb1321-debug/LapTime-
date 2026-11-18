import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Hash simples com scrypt (nativo do Node, sem dependência nova) — dá pra
// trocar por bcrypt/argon2 quando o Supabase Auth entrar, mas evita guardar
// senha em texto puro mesmo enquanto o cadastro é local.
export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha: string, senhaHash: string): boolean {
  const [salt, hashArmazenado] = senhaHash.split(":");
  if (!salt || !hashArmazenado) return false;
  const hash = scryptSync(senha, salt, 64);
  const armazenado = Buffer.from(hashArmazenado, "hex");
  if (hash.length !== armazenado.length) return false;
  return timingSafeEqual(hash, armazenado);
}
