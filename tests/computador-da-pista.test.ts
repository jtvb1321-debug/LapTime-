import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  inventarioDeLsusb,
  inventarioDePnp,
  inventarioDeRede,
  inventarioDeTty,
} from "../coletor/inventario.mjs";
import { POST as inventarioPOST } from "@/app/api/cronometragem/coletor/inventario/route";
import { POST as pearPOST } from "@/app/api/cronometragem/coletor/parear/route";
import {
  autenticarComputador,
  confirmarDecoder,
  criarPareamento,
  esquecerDecoder,
  listarComputadores,
  parear,
  registrarBase,
  registrarInventario,
  revogarComputador,
  validarInventario,
} from "@/lib/cronometragem/computadores-store";
import {
  autenticarDecoder,
  provisionarDecoderDoComputador,
} from "@/lib/cronometragem/decoders-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

describe("inventário do computador (leitura do sistema operacional)", () => {
  it("Windows: USB, porta serial e hubs (com interfaces repetidas do mesmo aparelho)", () => {
    const itens = inventarioDePnp([
      {
        FriendlyName: "USB Composite Device",
        InstanceId: "USB\\VID_0403&PID_6001\\A1",
        Class: "USB",
      },
      {
        FriendlyName: "Conversor X",
        InstanceId: "USB\\VID_0403&PID_6001&MI_00\\B2",
        Class: "USBDevice",
      },
      {
        FriendlyName: "Generic USB Hub",
        InstanceId: "USB\\VID_05E3&PID_0610\\C3",
        Class: "USB",
      },
      {
        FriendlyName: "USB Serial Port (COM3)",
        InstanceId: "FTDIBUS\\VID_0403+PID_6001+A1A\\0000",
        Class: "Ports",
      },
      {
        FriendlyName: "Intel Bluetooth",
        InstanceId: "BTHENUM\\DEV_1",
        Class: "Bluetooth",
      },
    ]);
    expect(itens.map((i) => [i.chave, i.tipo, i.nome])).toEqual([
      ["usb:VID_0403&PID_6001", "usb", "Conversor X"],
      ["serial:COM3", "serial", "USB Serial Port (COM3)"],
    ]);
    // um único item (o PowerShell não devolve lista) e nenhum item
    expect(
      inventarioDePnp({
        FriendlyName: "Webcam",
        InstanceId: "USB\\VID_0C45&PID_6366\\1",
        Class: "Camera",
      }),
    ).toHaveLength(1);
    expect(inventarioDePnp(null)).toEqual([]);
  });

  it("Linux: lsusb, portas /dev e vizinhos da rede", () => {
    expect(
      inventarioDeLsusb(
        "Bus 001 Device 004: ID 0403:6001 Future Technology Devices\nBus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub\n",
      ),
    ).toEqual([
      {
        chave: "usb:VID_0403&PID_6001",
        tipo: "usb",
        nome: "Future Technology Devices",
      },
    ]);
    expect(
      inventarioDeTty(["ttyS0", "ttyUSB0", "ttyACM1", "null"]).map(
        (i: { chave: string }) => i.chave,
      ),
    ).toEqual(["serial:/dev/ttyUSB0", "serial:/dev/ttyACM1"]);
    expect(
      inventarioDeRede([{ ip: "169.254.38.9", mac: "aa:bb:cc:dd:ee:ff" }]),
    ).toEqual([
      {
        chave: "rede:aa:bb:cc:dd:ee:ff",
        tipo: "rede",
        nome: "Aparelho na rede (169.254.38.9)",
        detalhe: "169.254.38.9",
      },
    ]);
  });

  it("o servidor valida o que o agente manda (entrada externa)", () => {
    expect(
      validarInventario([
        { chave: "usb:A", tipo: "usb", nome: " Aparelho " },
        { chave: "usb:A", tipo: "usb", nome: "repetido" },
        { chave: "", tipo: "usb" },
        { chave: "x".repeat(200) },
        { chave: "serial:COM1", tipo: "estranho" },
        "lixo",
        null,
      ]),
    ).toEqual([
      { chave: "usb:A", tipo: "usb", nome: "Aparelho" },
      { chave: "serial:COM1", tipo: "outro", nome: "serial:COM1" },
    ]);
    expect(() => validarInventario({ nao: "lista" })).toThrow(/lista/);
    expect(() =>
      validarInventario(
        Array.from({ length: 301 }, (_, i) => ({ chave: `c${i}` })),
      ),
    ).toThrow(/grande demais/);
  });
});

describe.skipIf(!temBancoDeTeste)(
  "computador da pista (pareamento e detecção)",
  () => {
    let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
    const ator = { usuarioId: "admin-1" };

    async function erroDe(promessa: Promise<unknown>): Promise<string> {
      try {
        await promessa;
      } catch (erro) {
        return (erro as Error).message;
      }
      return "";
    }

    function requisicao(corpo: unknown, token?: string): Request {
      return new Request("http://localhost/api", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(corpo),
      });
    }

    beforeAll(async () => {
      banco = await criarEsquemaDeTeste();
      await migrar();
    });
    afterAll(async () => {
      await banco.remover();
    });

    it("o código de pareamento vale uma vez, vence e troca por um token do computador", async () => {
      const { codigo } = await criarPareamento(ator);
      expect(codigo).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(await erroDe(parear("ZZZZ-ZZZZ", {}, null))).toMatch(
        /inválido ou vencido/,
      );
      expect(await erroDe(parear("curto", {}, null))).toMatch(/inválido/);

      const { token, computadorId } = await parear(
        codigo.toLowerCase(),
        { nome: "PC da pista", sistema: "win32 10" },
        "10.0.0.5",
      );
      expect(token).toMatch(/^gl_pc_/);
      expect(await autenticarComputador(token)).toMatchObject({
        id: computadorId,
      });
      expect(await autenticarComputador("gl_pc_falso")).toBeNull();
      expect(await autenticarComputador("qualquer")).toBeNull();
      // uso único
      expect(await erroDe(parear(codigo, {}, null))).toMatch(
        /inválido ou vencido/,
      );

      const vencido = await criarPareamento(ator);
      await consultar(
        "update coletor_pareamento set expira_em = now() - interval '1 minute'",
      );
      expect(await erroDe(parear(vencido.codigo, {}, null))).toMatch(
        /inválido ou vencido/,
      );
    });

    it("reconhece sozinho o decoder CalX Pro pelo MAC, sem confirmação do operador", async () => {
      const { codigo } = await criarPareamento(ator);
      const { computadorId } = await parear(codigo, { nome: "PC pista" }, null);
      const [decoder] = inventarioDeRede([
        { ip: "192.168.137.50", mac: "34:ea:e7:57:78:41" },
      ]);
      expect(decoder.nome).toBe("Decoder CalX Pro (192.168.137.50)");
      await registrarInventario(computadorId, [decoder], null);
      const pc = (await listarComputadores()).find(
        (c) => c.id === computadorId,
      )!;
      expect(pc.dispositivos[0].decoder?.nome).toBe("Decoder CalX Pro");
    });

    it("cadastra o CalX Pro sozinho, uma única vez, e renova a chave nas próximas", async () => {
      const { codigo } = await criarPareamento(ator);
      const { computadorId } = await parear(codigo, { nome: "PC pista" }, null);
      const a = await provisionarDecoderDoComputador(
        computadorId,
        { driver: "calx-pro", endereco: "192.168.137.50" },
        null,
      );
      expect(a.criado).toBe(true);
      expect(await autenticarDecoder(a.token)).toMatchObject({ id: a.id });

      const b = await provisionarDecoderDoComputador(
        computadorId,
        { driver: "calx-pro", endereco: "192.168.137.60" },
        null,
      );
      expect(b.criado).toBe(false);
      expect(b.id).toBe(a.id);
      expect(b.token).not.toBe(a.token);
      expect(await autenticarDecoder(a.token)).toBeNull(); // chave antiga não vale
      expect(await autenticarDecoder(b.token)).toMatchObject({ id: a.id });

      const [{ n }] = await consultar<{ n: number }>(
        "select count(*)::int as n from decoder where computador_id = $1",
        [computadorId],
      );
      expect(n).toBe(1);
      await expect(
        provisionarDecoderDoComputador(computadorId, { driver: "outro" }, null),
      ).rejects.toThrow(/não é cadastrado sozinho/);
    });

    it("detecta o dispositivo novo depois da base e passa a reconhecer o decoder confirmado", async () => {
      const { codigo } = await criarPareamento(ator);
      const { token, computadorId } = await parear(
        codigo,
        { nome: "Notebook" },
        null,
      );
      const base = [
        {
          chave: "usb:VID_8087&PID_0033",
          tipo: "usb" as const,
          nome: "Bluetooth",
        },
        {
          chave: "rede:aa:aa:aa:aa:aa:aa",
          tipo: "rede" as const,
          nome: "Roteador",
        },
      ];
      await registrarInventario(computadorId, base, "10.0.0.5");
      let pc = (await listarComputadores()).find((c) => c.id === computadorId)!;
      expect(pc.online).toBe(true);
      expect(pc.temBase).toBe(false);
      expect(pc.dispositivos.every((d) => !d.novo)).toBe(true);

      expect(await registrarBase(computadorId, ator)).toBe(2);

      // o decoder é plugado
      await registrarInventario(
        computadorId,
        [
          ...base,
          {
            chave: "usb:VID_1234&PID_ABCD",
            tipo: "usb",
            nome: "Aparelho novo",
          },
        ],
        null,
      );
      pc = (await listarComputadores()).find((c) => c.id === computadorId)!;
      expect(pc.dispositivos.filter((d) => d.novo).map((d) => d.chave)).toEqual(
        ["usb:VID_1234&PID_ABCD"],
      );

      expect(
        await erroDe(
          confirmarDecoder(
            computadorId,
            "usb:NAO_ESTA_LIGADO",
            "CalX Pro",
            ator,
          ),
        ),
      ).toMatch(/não está mais ligado/);
      expect(
        await erroDe(
          confirmarDecoder(computadorId, "usb:VID_1234&PID_ABCD", "X", ator),
        ),
      ).toMatch(/nome/i);
      await confirmarDecoder(
        computadorId,
        "usb:VID_1234&PID_ABCD",
        "CalX Pro",
        ator,
      );
      pc = (await listarComputadores()).find((c) => c.id === computadorId)!;
      expect(
        pc.dispositivos.find((d) => d.chave === "usb:VID_1234&PID_ABCD")
          ?.decoder,
      ).toEqual({ nome: "CalX Pro" });

      // desligou e voltou (outra porta, mesmo aparelho): reconhecido de novo
      await registrarInventario(computadorId, base, null);
      await registrarInventario(
        computadorId,
        [
          ...base,
          {
            chave: "usb:VID_1234&PID_ABCD",
            tipo: "usb",
            nome: "Aparelho novo",
          },
        ],
        null,
      );
      pc = (await listarComputadores()).find((c) => c.id === computadorId)!;
      expect(pc.dispositivos.some((d) => d.decoder?.nome === "CalX Pro")).toBe(
        true,
      );

      await esquecerDecoder("usb:VID_1234&PID_ABCD", ator);
      pc = (await listarComputadores()).find((c) => c.id === computadorId)!;
      expect(pc.dispositivos.some((d) => d.decoder)).toBe(false);
      expect(
        await erroDe(esquecerDecoder("usb:VID_1234&PID_ABCD", ator)),
      ).toMatch(/não encontrado/);

      // computador sem contato aparece como desconectado
      await consultar(
        "update coletor_computador set ultimo_contato = now() - interval '5 minutes' where id = $1",
        [computadorId],
      );
      pc = (await listarComputadores()).find((c) => c.id === computadorId)!;
      expect(pc.online).toBe(false);

      // desligar o computador: o token deixa de valer e ele some da lista
      await revogarComputador(computadorId, ator);
      expect(await autenticarComputador(token)).toBeNull();
      expect(
        (await listarComputadores()).some((c) => c.id === computadorId),
      ).toBe(false);
    });

    it("as rotas do agente: parear e mandar inventário, com token e limites", async () => {
      const { codigo } = await criarPareamento(ator);
      const ruim = await pearPOST(requisicao({ codigo: "AAAA-BBBB" }));
      expect(ruim.status).toBe(400);

      const ok = await pearPOST(requisicao({ codigo, nome: "PC rota" }));
      expect(ok.status).toBe(200);
      const { token, computadorId } = await ok.json();

      expect(
        (await inventarioPOST(requisicao({ dispositivos: [] }))).status,
      ).toBe(401);
      expect(
        (await inventarioPOST(requisicao({ dispositivos: [] }, "gl_pc_errado")))
          .status,
      ).toBe(401);
      expect(
        (await inventarioPOST(requisicao({ dispositivos: "nada" }, token)))
          .status,
      ).toBe(400);

      const enviado = await inventarioPOST(
        requisicao(
          {
            dispositivos: [
              { chave: "usb:VID_0001&PID_0002", tipo: "usb", nome: "Teste" },
            ],
          },
          token,
        ),
      );
      expect(enviado.status).toBe(200);
      expect(await enviado.json()).toMatchObject({ ok: true, dispositivos: 1 });
      const pc = (await listarComputadores()).find(
        (c) => c.id === computadorId,
      )!;
      expect(pc.dispositivos.map((d) => d.chave)).toEqual([
        "usb:VID_0001&PID_0002",
      ]);
    });
  },
);
