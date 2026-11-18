// Formatos espelham as tabelas planejadas em supabase/migrations (ver README).
// Mantidos aqui para a camada de dados fictícios e para as queries reais usarem o mesmo shape.

import type { PontoRota } from "@/lib/tracado3d/rota";

export type PapelUsuario =
  "admin" | "fiscal" | "operador" | "recepcao" | "piloto";

export interface Perfil {
  id: string;
  userId: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  pilotoId?: string;
  avatarUrl?: string;
  // Só quem se cadastra sozinho (ver lib/cadastro-actions.ts) tem senha de
  // verdade — contas de demonstração seguem aceitando qualquer senha.
  senhaHash?: string;
}

export type StatusEtapa =
  "agendada" | "em_andamento" | "encerrada" | "cancelada";

export interface Campeonato {
  id: string;
  nome: string;
  temporada: string;
  slug: string;
  descricao: string;
  ativo: boolean;
}

export interface Etapa {
  id: string;
  campeonatoId: string;
  numero: number;
  nome: string;
  kartodromo: string;
  cidade: string;
  data: string;
  status: StatusEtapa;
  tracadoId?: string;
}

// Ponto da rota sobre o modelo 3D do kartódromo (X/Z do mundo, em metros
// estimados). Definido em lib/tracado3d/rota.ts.
export type { PontoRota };

export interface Tracado {
  id: string;
  nome: string;
  // Percurso desenhado no editor 3D, sobre o asfalto do modelo. Os pontos
  // originais ficam editáveis; a curva suave é calculada a partir deles.
  pontos: PontoRota[];
  // Circuito fechado (repete voltas) ou rota aberta.
  fechado: boolean;
  // Distância estimada pelo editor, em metros (referência, não medição).
  extensaoMetros?: number;
  descricao?: string;
}

export interface Serie {
  id: string;
  etapaId: string;
  categoriaId: string;
  nome: string;
  ordem: number;
}

export type NivelCategoria = "feminina" | "intermediaria" | "rookie" | "master";

export interface Categoria {
  id: string;
  nome: string;
  nivel: NivelCategoria;
  slug: string;
  descricao: string;
  pesoMinimoKg: number;
}

export interface Piloto {
  id: string;
  nome: string;
  // Como o piloto quer ser chamado — vira o nome mostrado em público (site,
  // overlay); `nome` continua sendo o nome completo/legal.
  apelido?: string;
  slug: string;
  numero: number;
  categoriaId: string;
  cidade?: string;
  uf?: string;
  avatarUrl?: string;
  idade?: number;
  pesoKg?: number;
  // Assinatura pessoal (número + nome com cores escolhidas pelo piloto),
  // exibida quando ele faz pole, vence ou crava a volta mais rápida.
  corNumero?: string;
  corAssinatura?: string;
  vitorias: number;
  podios: number;
  pontos: number;
  posicaoCampeonato: number;
}

export type StatusInscricao = "confirmada" | "aguardando" | "cancelada";

export interface Inscricao {
  id: string;
  etapaId: string;
  pilotoId: string;
  categoriaId: string;
  status: StatusInscricao;
  criadaEm: string;
}

export type StatusPagamento = "confirmado" | "aguardando" | "cancelado";

export interface Pagamento {
  id: string;
  inscricaoId: string;
  valorCentavos: number;
  status: StatusPagamento;
  metodo: "pix" | "cartao" | "boleto";
  criadaEm: string;
}

export type StatusKart = "disponivel" | "manutencao" | "em_uso";

export interface Kart {
  id: string;
  numero: number;
  placa: string;
  status: StatusKart;
  etapaId?: string;
}

export type StatusBateria = "agendada" | "grid" | "ao_vivo" | "encerrada";

export interface Bateria {
  id: string;
  etapaId: string;
  categoriaId: string;
  nome: string;
  numero: number;
  voltas: number;
  status: StatusBateria;
  horario: string;
}

export interface Resultado {
  id: string;
  bateriaId: string;
  pilotoId: string;
  kartId: string;
  posicao: number;
  melhorVoltaMs: number;
  gapMs: number;
  pontos: number;
  voltaAtual?: number;
}

export type TipoPunicao =
  "drive_through" | "tempo" | "grid" | "desqualificacao" | "advertencia";

export interface Punicao {
  id: string;
  bateriaId: string;
  pilotoId: string;
  tipo: TipoPunicao;
  motivo: string;
  aplicadaEm: string;
}

export interface LogSistema {
  id: string;
  usuarioId?: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  criadoEm: string;
}

export interface Patrocinador {
  id: string;
  nome: string;
  logoUrl?: string;
  ativo: boolean;
}
