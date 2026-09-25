"use server";

export type InscricaoState = { erro?: string; sucesso?: boolean };

export async function inscricaoMockAction(
  _prevState: InscricaoState,
  formData: FormData,
): Promise<InscricaoState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const categoriaId = String(formData.get("categoriaId") ?? "");
  const etapaId = String(formData.get("etapaId") ?? "");
  const aceite = formData.get("aceite");

  if (!nome || !email || !categoriaId || !etapaId) {
    return { erro: "Preencha todos os campos." };
  }
  if (!aceite) {
    return { erro: "É preciso aceitar o regulamento para se inscrever." };
  }

  // Modo demonstração: não há persistência ainda. Quando o Supabase estiver
  // plugado, isto vira um insert nas tabelas `inscricoes` (+ `pagamentos`).
  return { sucesso: true };
}
