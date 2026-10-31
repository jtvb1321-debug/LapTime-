import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  abrirBateriaDoSlot,
  cadastrarPilotoNaBateria,
  lerCorrida,
  lerPainel,
} from "@/lib/cronometragem/corridas-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import {
  agendarBateria,
  lerAgendaDoDia,
  padroesDeAgenda,
} from "@/lib/operacao/agenda-store";
import { cancelarBateria } from "@/lib/operacao/agenda-store";
import { obterOuCriarCliente } from "@/lib/operacao/clientes-store";
import { listarPilotosDasReservas } from "@/lib/operacao/reserva-pilotos-store";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

describe.skipIf(!temBancoDeTeste)(
  "agendar e abrir a bateria sem etapas",
  () => {
    let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
    const ator = { usuarioId: "balcao-1" };
    const DIA = "2032-03-09";

    async function erroDe(promessa: Promise<unknown>): Promise<string> {
      try {
        await promessa;
      } catch (erro) {
        return (erro as Error).message;
      }
      return "";
    }

    beforeAll(async () => {
      banco = await criarEsquemaDeTeste();
      await migrar();
    });
    afterAll(async () => {
      await banco.remover();
    });

    it("sem nenhum horário criado, o preço é exigido uma vez; depois vale o da última bateria", async () => {
      expect(await padroesDeAgenda()).toEqual({
        duracaoMin: 15,
        capacidade: 12,
        precoCentavos: null,
      });
      const ana = await obterOuCriarCliente(
        { nome: "Ana Prado", telefone: "11944440001" },
        ator,
      );
      expect(
        await erroDe(
          agendarBateria(
            { dia: DIA, hora: "14:00", clienteId: ana.id, pilotos: 2 },
            ator,
          ),
        ),
      ).toMatch(/Informe o preço/);

      const { slotId, reservaId } = await agendarBateria(
        {
          dia: DIA,
          hora: "14:00",
          clienteId: ana.id,
          pilotos: 2,
          precoCentavos: 9000,
        },
        ator,
      );
      expect(await padroesDeAgenda()).toMatchObject({ precoCentavos: 9000 });

      // o horário nasceu da reserva e o responsável é o piloto 1
      const agenda = await lerAgendaDoDia(DIA);
      expect(agenda).toHaveLength(1);
      expect(agenda[0]).toMatchObject({
        id: slotId,
        capacidade: 12,
        ocupadas: 2,
      });
      expect(agenda[0].reservas[0]).toMatchObject({
        id: reservaId,
        valorCentavos: 18000,
      });
      const pilotos = (await listarPilotosDasReservas([reservaId])).get(
        reservaId,
      )!;
      expect(pilotos.map((p) => p.nome)).toEqual(["Ana Prado"]);

      // outra reserva no mesmo horário reaproveita o horário (sem preço, sem duplicar)
      const bia = await obterOuCriarCliente(
        { nome: "Bia Reis", telefone: "11944440002" },
        ator,
      );
      const outra = await agendarBateria(
        { dia: DIA, hora: "14:00", clienteId: bia.id, pilotos: 1 },
        ator,
      );
      expect(outra.slotId).toBe(slotId);
      expect((await lerAgendaDoDia(DIA))[0].ocupadas).toBe(3);

      // outro horário do mesmo dia usa o preço da última bateria
      const noite = await agendarBateria(
        { dia: DIA, hora: "20:30", clienteId: bia.id, pilotos: 1 },
        ator,
      );
      expect(noite.slotId).not.toBe(slotId);
      expect((await lerAgendaDoDia(DIA)).map((s) => s.precoCentavos)).toEqual([
        9000, 9000,
      ]);
    });

    it("recusa dia e hora inválidos, lotação e horário cancelado", async () => {
      const c = await obterOuCriarCliente(
        { nome: "Caio Neri", telefone: "11944440003" },
        ator,
      );
      expect(
        await erroDe(
          agendarBateria(
            { dia: "2032-13-40", hora: "10:00", clienteId: c.id, pilotos: 1 },
            ator,
          ),
        ),
      ).toMatch(/Escolha o dia/);
      expect(
        await erroDe(
          agendarBateria(
            { dia: DIA, hora: "25:99", clienteId: c.id, pilotos: 1 },
            ator,
          ),
        ),
      ).toMatch(/Escolha a hora/);
      expect(
        await erroDe(
          agendarBateria(
            { dia: DIA, hora: "14:00", clienteId: c.id, pilotos: 30 },
            ator,
          ),
        ),
      ).toMatch(/Só resta|restam/);

      const { slotId } = await agendarBateria(
        { dia: DIA, hora: "18:00", clienteId: c.id, pilotos: 1 },
        ator,
      );
      // sem reservas ativas o horário pode ser cancelado, e não se agenda nele
      await consultar(
        "update reserva set status = 'cancelada', cancelada_em = now() where slot_id = $1",
        [slotId],
      );
      await cancelarBateria(slotId, ator);
      expect(
        await erroDe(
          agendarBateria(
            { dia: DIA, hora: "18:00", clienteId: c.id, pilotos: 1 },
            ator,
          ),
        ),
      ).toMatch(/foi cancelado/);
    });

    it("abrir a bateria da agenda cria a classificação com os pilotos e reabre a mesma depois", async () => {
      const agenda = await lerAgendaDoDia(DIA);
      const slot = agenda.find((s) => s.reservas.length >= 2 && !s.cancelada)!;
      const id = await abrirBateriaDoSlot(slot.id, ator);
      const painel = (await lerPainel(id))!;
      expect(painel.corrida).toMatchObject({
        fase: "classificacao",
        slotId: slot.id,
      });
      expect(painel.grid.map((g) => g.nome).sort()).toEqual(
        ["Ana Prado", "Bia Reis", "Vaga 2 de Ana Prado"].sort(),
      );
      // clicar de novo abre a mesma bateria, sem criar outra
      expect(await abrirBateriaDoSlot(slot.id, ator)).toBe(id);
      expect((await lerCorrida(id))?.estado).toBe("preparada");

      // piloto cadastrado direto na bateria ocupa a vaga da reserva e entra nela
      await cadastrarPilotoNaBateria(
        id,
        { nome: "Davi Teste", telefone: "11944440099" },
        ator,
      );
      const depois = (await lerPainel(id))!;
      expect(depois.grid.map((g) => [g.nome, g.vaga]).sort()).toEqual([
        ["Ana Prado", false],
        ["Bia Reis", false],
        ["Davi Teste", false],
      ]);
      const reservaDaAna = depois.grid.find(
        (g) => g.nome === "Ana Prado",
      )!.reservaId!;
      expect(
        (await listarPilotosDasReservas([reservaDaAna]))
          .get(reservaDaAna)!
          .map((p) => p.nome),
      ).toEqual(["Ana Prado", "Davi Teste"]);
      expect(
        depois.grid.find((g) => g.nome === "Davi Teste")?.pagamento?.situacao,
      ).toBe("a_pagar");
    });
  },
);
