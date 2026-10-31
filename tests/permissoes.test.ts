import { describe, expect, it } from "vitest";
import { PERMISSOES, pode } from "@/lib/permissoes";

describe("permissões por papel", () => {
  it("admin tem todas as permissões", () => {
    for (const permissao of PERMISSOES) {
      expect(pode("admin", permissao)).toBe(true);
    }
  });

  it("piloto não tem nenhuma permissão administrativa", () => {
    for (const permissao of PERMISSOES) {
      expect(pode("piloto", permissao)).toBe(false);
    }
  });

  it("fiscal opera e corrige, mas não homologa nem administra equipamentos/usuários", () => {
    expect(pode("fiscal", "sessao.operar")).toBe(true);
    expect(pode("fiscal", "penalidade.registrar")).toBe(true);
    expect(pode("fiscal", "resultado.corrigir")).toBe(true);
    expect(pode("fiscal", "resultado.homologar")).toBe(false);
    expect(pode("fiscal", "equipamento.administrar")).toBe(false);
    expect(pode("fiscal", "usuario.administrar")).toBe(false);
    expect(pode("fiscal", "simulacao.alternar")).toBe(false);
  });

  it("operador inicia/encerra provas, mas não penaliza, corrige nem homologa", () => {
    expect(pode("operador", "sessao.operar")).toBe(true);
    expect(pode("operador", "prova.iniciar_encerrar")).toBe(true);
    expect(pode("operador", "penalidade.registrar")).toBe(false);
    expect(pode("operador", "resultado.corrigir")).toBe(false);
    expect(pode("operador", "resultado.homologar")).toBe(false);
    expect(pode("operador", "cadastro.gerenciar")).toBe(false);
  });

  it("papel desconhecido (ex.: cookie adulterado) não tem permissão nenhuma", () => {
    expect(pode("superusuario" as never, "painel.acessar")).toBe(false);
  });
});
