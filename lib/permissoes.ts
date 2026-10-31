import type { PapelUsuario } from "@/lib/types";

// Permissões por ação (não por tela). Cada papel recebe só o que precisa:
//  - admin: tudo, incluindo usuários e equipamentos;
//  - fiscal: opera provas, aplica penalidades e corrige resultados, mas não
//    homologa nem administra equipamentos/usuários;
//  - operador: opera sessões e inicia/encerra provas;
//  - recepcao: balcão — clientes, agenda de baterias e caixa (receber, sangria,
//    fechar); só o admin estorna pagamento, edita o termo e vê o financeiro;
//  - piloto: nenhuma ação administrativa.
export const PERMISSOES = [
  "painel.acessar",
  "sessao.operar",
  "prova.iniciar_encerrar",
  "penalidade.registrar",
  "resultado.corrigir",
  "resultado.homologar",
  "equipamento.administrar",
  "relatorio.consultar",
  "cadastro.gerenciar",
  "usuario.administrar",
  "simulacao.alternar",
  "agenda.gerenciar",
  "cliente.gerenciar",
  "caixa.operar",
  "caixa.estornar",
  "termo.editar",
  "financeiro.gerenciar",
  "cronometragem.ver",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

const POR_PAPEL: Record<PapelUsuario, readonly Permissao[]> = {
  admin: PERMISSOES,
  fiscal: [
    "painel.acessar",
    "sessao.operar",
    "prova.iniciar_encerrar",
    "penalidade.registrar",
    "resultado.corrigir",
    "relatorio.consultar",
    "cadastro.gerenciar",
    "cronometragem.ver",
  ],
  operador: [
    "painel.acessar",
    "sessao.operar",
    "prova.iniciar_encerrar",
    "relatorio.consultar",
    "cronometragem.ver",
  ],
  recepcao: [
    "painel.acessar",
    "agenda.gerenciar",
    "cliente.gerenciar",
    "caixa.operar",
  ],
  piloto: [],
};

export function pode(papel: PapelUsuario, permissao: Permissao): boolean {
  return POR_PAPEL[papel]?.includes(permissao) ?? false;
}
