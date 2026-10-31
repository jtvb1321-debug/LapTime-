import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cadastrarPilotoComPerfil,
  ehViolacaoDeUnicidade,
} from "@/lib/cadastro-store";
import { consultar } from "@/lib/db/conexao";
import { importarJsonLegado } from "@/lib/db/importar-json";
import { migrar } from "@/lib/db/migrar";
import { substituirDadosDeCorrida } from "@/lib/mock/data";
import {
  lerPatrocinadores,
  salvarPatrocinadores,
} from "@/lib/patrocinadores-store";
import { lerPerfis } from "@/lib/perfis-store";
import { lerPilotos, lerPilotosReais } from "@/lib/pilotos-store";
import type { Perfil, Piloto } from "@/lib/types";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

function piloto(sobre: Partial<Piloto> & { id: string; slug: string }): Piloto {
  return {
    nome: "Piloto Teste",
    numero: 50,
    categoriaId: "cat-master",
    vitorias: 0,
    podios: 0,
    pontos: 0,
    posicaoCampeonato: 0,
    ...sobre,
  };
}

function perfil(
  sobre: Partial<Perfil> & { id: string; email: string },
): Perfil {
  return {
    userId: `user-${sobre.id}`,
    nome: "Perfil Teste",
    papel: "piloto",
    ...sobre,
  };
}

describe.skipIf(!temBancoDeTeste)(
  "importação dos JSON antigos e stores",
  () => {
    let remover: () => Promise<void>;
    let pasta: string;

    beforeAll(async () => {
      ({ remover } = await criarEsquemaDeTeste());
      await migrar();
      pasta = fs.mkdtempSync(path.join(os.tmpdir(), "gridlap-import-"));
    });
    afterAll(async () => {
      await remover();
      fs.rmSync(pasta, { recursive: true, force: true });
    });

    it("importa perfis, pilotos reais e patrocinadores — sem os pilotos de demonstração", async () => {
      fs.writeFileSync(
        path.join(pasta, "perfis.json"),
        JSON.stringify([
          perfil({
            id: "perfil-demo",
            email: "demo@exemplo.com",
            papel: "admin",
          }),
          perfil({
            id: "perfil-real",
            email: "real@exemplo.com",
            senhaHash: "salt:hash",
          }),
        ]),
      );
      fs.writeFileSync(
        path.join(pasta, "pilotos.json"),
        JSON.stringify([
          piloto({ id: "pil-eduardo", slug: "eduardo" }),
          piloto({ id: "piloto-1", slug: "joao-1", numero: 11, pesoKg: 74.5 }),
        ]),
      );
      fs.writeFileSync(
        path.join(pasta, "patrocinadores.json"),
        JSON.stringify([
          { id: "p2", nome: "Segundo", ativo: true },
          {
            id: "p1",
            nome: "Primeiro",
            ativo: false,
            logoUrl: "data:image/png;base64,AAAA",
          },
        ]),
      );

      const feitas = await importarJsonLegado(pasta);
      expect(feitas.map((f) => [f.arquivo, f.linhas])).toEqual([
        ["perfis.json", 2],
        ["pilotos.json", 1],
        ["patrocinadores.json", 2],
      ]);

      const perfis = await lerPerfis();
      expect(perfis.map((p) => p.id)).toEqual(["perfil-demo", "perfil-real"]);
      expect(perfis[1].senhaHash).toBe("salt:hash");

      const reais = await lerPilotosReais();
      expect(reais.map((p) => p.id)).toEqual(["piloto-1"]);
      expect(reais[0].pesoKg).toBe(74.5);

      // A ordem original dos patrocinadores é preservada.
      expect((await lerPatrocinadores()).map((p) => p.id)).toEqual([
        "p2",
        "p1",
      ]);
    });

    it("repetir a importação não duplica nada e não altera os arquivos", async () => {
      const antes = fs.readFileSync(path.join(pasta, "perfis.json"), "utf-8");
      expect(await importarJsonLegado(pasta)).toEqual([]);
      expect(await lerPerfis()).toHaveLength(2);
      expect(await lerPilotosReais()).toHaveLength(1);
      expect(fs.readFileSync(path.join(pasta, "perfis.json"), "utf-8")).toBe(
        antes,
      );
    });

    it("salvarPatrocinadores substitui a lista inteira mantendo a ordem", async () => {
      await salvarPatrocinadores([
        { id: "a", nome: "A", ativo: true },
        { id: "b", nome: "B", ativo: true, logoUrl: "x" },
        { id: "c", nome: "C", ativo: false },
      ]);
      expect((await lerPatrocinadores()).map((p) => p.id)).toEqual([
        "a",
        "b",
        "c",
      ]);
      await salvarPatrocinadores([{ id: "z", nome: "Z", ativo: true }]);
      expect(await lerPatrocinadores()).toEqual([
        { id: "z", nome: "Z", logoUrl: undefined, ativo: true },
      ]);
    });

    it("cadastro é atômico: e-mail repetido não deixa piloto pela metade", async () => {
      const antes = (await lerPilotosReais()).length;
      await cadastrarPilotoComPerfil(
        piloto({ id: "piloto-2", slug: "maria-2", numero: 12 }),
        perfil({ id: "perfil-piloto-2", email: "maria@exemplo.com" }),
      );
      expect(await lerPilotosReais()).toHaveLength(antes + 1);

      // Mesmo e-mail (em maiúsculas): o perfil falha, então o piloto também
      // não pode ficar.
      const erro = await cadastrarPilotoComPerfil(
        piloto({ id: "piloto-3", slug: "outra-3", numero: 13 }),
        perfil({ id: "perfil-piloto-3", email: "MARIA@exemplo.com" }),
      ).catch((e: unknown) => e);
      expect(ehViolacaoDeUnicidade(erro)).toBe(true);
      expect(await lerPilotosReais()).toHaveLength(antes + 1);
      const [{ n }] = await consultar<{ n: number }>(
        "select count(*)::int as n from piloto where id = 'piloto-3'",
      );
      expect(n).toBe(0);
    });

    it("lerPilotos junta simulados + reais, e os reais entram depois na classificação", async () => {
      const reais = await lerPilotosReais();
      substituirDadosDeCorrida({
        pilotos: [piloto({ id: "pil-x", slug: "x", posicaoCampeonato: 1 })],
        baterias: [],
        resultados: [],
        simulacaoAtiva: true,
      });
      const todos = await lerPilotos();
      expect(todos[0].id).toBe("pil-x");
      expect(todos.slice(1).map((p) => p.posicaoCampeonato)).toEqual(
        reais.map((_, i) => 2 + i),
      );

      // Desligada a simulação, só sobram os reais — e nenhum simulado foi
      // gravado no banco.
      substituirDadosDeCorrida({
        pilotos: [],
        baterias: [],
        resultados: [],
        simulacaoAtiva: false,
      });
      expect((await lerPilotos()).map((p) => p.id)).toEqual(
        reais.map((p) => p.id),
      );
      const [{ n }] = await consultar<{ n: number }>(
        "select count(*)::int as n from piloto where id like 'pil-%'",
      );
      expect(n).toBe(0);
    });
  },
);
