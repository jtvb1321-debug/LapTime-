import type { PilotoDaCorrida } from "@/lib/cronometragem/corridas-store";

export type TipoPendencia =
  "vaga" | "termo" | "pagamento" | "checkin" | "kart" | "transponder";

export interface Pendencia {
  tipo: TipoPendencia;
  texto: string;
}

// O que ainda falta para o piloto entrar na pista. Só descreve; quem bloqueia a
// largada continua sendo a regra atual (termo assinado e kart definido = apto).
// Pagamento e check-in são avisos: não impedem a largada.
export function pendenciasDoPiloto(p: PilotoDaCorrida): Pendencia[] {
  if (p.vaga) return [{ tipo: "vaga", texto: "Vaga sem piloto cadastrado" }];
  const lista: Pendencia[] = [];
  if (p.termo === "sem_cadastro") {
    lista.push({ tipo: "termo", texto: "Sem cadastro para o termo" });
  } else if (p.termo === "pendente") {
    lista.push({ tipo: "termo", texto: "Termo pendente" });
  }
  if (p.pagamento && p.pagamento.situacao !== "pago") {
    lista.push({ tipo: "pagamento", texto: "Pagamento a receber" });
  }
  if (!p.presenteEm) lista.push({ tipo: "checkin", texto: "Check-in" });
  if (!p.kartNumero) {
    lista.push({ tipo: "kart", texto: "Kart não definido" });
  } else if (!p.transponder) {
    lista.push({ tipo: "transponder", texto: "Kart sem sensor identificado" });
  }
  return lista;
}

export function pilotosComPendencia(grid: PilotoDaCorrida[]) {
  return grid
    .map((piloto) => ({ piloto, pendencias: pendenciasDoPiloto(piloto) }))
    .filter((x) => x.pendencias.length > 0);
}
