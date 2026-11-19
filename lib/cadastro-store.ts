import { transacao } from "@/lib/db/conexao";
import { inserirPerfil } from "@/lib/perfis-store";
import { incluirPilotoNosCampeonatos } from "@/lib/campeonatos-store";
import { inserirPiloto } from "@/lib/pilotos-store";
import type { Perfil, Piloto } from "@/lib/types";

// Cadastro de piloto: o piloto e a conta de acesso entram juntos ou não
// entram (se o e-mail ou o slug já existir, nada fica pela metade).
export async function cadastrarPilotoComPerfil(
  piloto: Piloto,
  perfil: Perfil,
): Promise<void> {
  await transacao(async (cliente) => {
    await inserirPiloto(cliente, piloto);
    await incluirPilotoNosCampeonatos(cliente, piloto.id);
    await inserirPerfil(cliente, perfil);
  });
}

// Violação de unicidade do Postgres (e-mail/slug repetidos numa corrida de
// dois cadastros simultâneos).
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return (
    typeof erro === "object" &&
    erro !== null &&
    (erro as { code?: string }).code === "23505"
  );
}
