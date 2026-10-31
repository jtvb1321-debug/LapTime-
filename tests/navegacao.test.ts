import { describe, expect, it } from "vitest";
import { ADMIN_NAV, menuParaPapel } from "@/lib/admin-nav";
import type { PapelUsuario } from "@/lib/types";

const resumo = (papel: PapelUsuario) =>
  Object.fromEntries(
    menuParaPapel(papel).map((g) => [g.titulo, g.itens.map((i) => i.label)]),
  );

const CAMPEONATO = [
  "Campeonatos",
  "Etapas",
  "Categorias",
  "Traçados",
  "Vídeo do traçado",
  "Patrocinadores",
  "Pilotos",
  "Inscrições",
  "Pagamentos",
  "Karts do campeonato",
  "Balizamento",
  "Baterias do campeonato",
  "Live timing",
  "Resultados",
  "Pontuação",
  "Punições",
  "Recursos",
];
const EQUIPAMENTOS = ["Decoder e agente", "Karts", "Transponders"];

// Matriz explícita de acesso ao menu, por perfil. Mudou o menu, mude aqui de
// propósito: mover um item de grupo não pode ampliar permissão.
describe("menu do painel por perfil", () => {
  it("tem no máximo sete grupos e nenhum link repetido", () => {
    expect(ADMIN_NAV.length).toBeLessThanOrEqual(7);
    const hrefs = ADMIN_NAV.flatMap((g) => g.itens.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("admin vê tudo", () => {
    expect(resumo("admin")).toEqual({
      Operação: ["Visão do dia", "Agenda", "Clientes"],
      Cronometragem: ["Baterias e provas"],
      Campeonato: CAMPEONATO,
      Financeiro: [
        "Caixa",
        "Relatório do dia",
        "Fluxo de caixa",
        "Contas a pagar",
      ],
      Equipamentos: EQUIPAMENTOS,
      Relatórios: ["Painel gerencial", "Relatórios do campeonato"],
      Configurações: ["Campeonato e imagem", "Termo de responsabilidade"],
    });
  });

  it("fiscal e operador: pista, campeonato e relatórios; sem balcão, financeiro e termo", () => {
    for (const papel of ["fiscal", "operador"] as const) {
      expect(resumo(papel)).toEqual({
        Operação: ["Visão do dia"],
        Cronometragem: ["Baterias e provas"],
        Campeonato: CAMPEONATO,
        Equipamentos: EQUIPAMENTOS,
        Relatórios: ["Painel gerencial", "Relatórios do campeonato"],
        Configurações: ["Campeonato e imagem"],
      });
    }
  });

  it("recepção: só balcão e caixa, sem campeonato, dashboard ou equipamentos", () => {
    expect(resumo("recepcao")).toEqual({
      Operação: ["Visão do dia", "Agenda", "Clientes"],
      Financeiro: ["Caixa"],
    });
  });

  it("piloto não tem menu do painel", () => {
    expect(menuParaPapel("piloto")).toEqual([]);
  });
});
