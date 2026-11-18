"use server";

import {
  confirmarDecoder,
  criarPareamento,
  esquecerDecoder,
  registrarBase,
  revogarComputador,
} from "@/lib/cronometragem/computadores-store";
import {
  adicionarSensorAoKart,
  listarKarts,
  removerSensorDoKart,
  salvarKart,
  salvarModeloDeVinculo,
  salvarTransponder,
  type ModeloVinculo,
  type StatusKart,
  type StatusTransponder,
} from "@/lib/cronometragem/cadastros-store";
import { executarAcao, textoDoForm } from "@/lib/cronometragem/executar";
import {
  planejarVinculos,
  type PedidoDeVinculo,
} from "@/lib/cronometragem/vinculo-em-lote";
import { ErroNegocio } from "@/lib/operacao/erros";
import type { AcaoState } from "@/lib/operacao-actions";

export async function salvarTransponderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await salvarTransponder(
      textoDoForm(dados, "codigo"),
      {
        rotulo: textoDoForm(dados, "rotulo"),
        modelo: textoDoForm(dados, "modelo"),
        status: textoDoForm(dados, "status") as StatusTransponder,
        observacoes: textoDoForm(dados, "observacoes"),
      },
      ator,
    );
    return "Transponder salvo.";
  });
}

export async function salvarKartAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const id = textoDoForm(dados, "kartId");
    await salvarKart(
      id || null,
      {
        numero: textoDoForm(dados, "numero"),
        apelido: textoDoForm(dados, "apelido"),
        status: textoDoForm(dados, "status") as StatusKart,
        transponderFixo: textoDoForm(dados, "transponderFixo"),
        observacoes: textoDoForm(dados, "observacoes"),
      },
      ator,
    );
    return id ? "Kart atualizado." : "Kart cadastrado.";
  });
}

// Cria os karts 1 até N que ainda não existem (os que já existem ficam como
// estão). Cada kart passa pela mesma regra e auditoria do cadastro de kart.
export async function criarKartsAteAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const ate = Number(textoDoForm(dados, "ate"));
    if (!Number.isInteger(ate) || ate < 1 || ate > 60) {
      throw new ErroNegocio("Informe um número de karts entre 1 e 60.");
    }
    const existentes = new Set((await listarKarts()).map((k) => k.numero));
    let criados = 0;
    for (let n = 1; n <= ate; n++) {
      if (existentes.has(String(n))) continue;
      await salvarKart(null, { numero: String(n), status: "ativo" }, ator);
      criados++;
    }
    return criados === 0
      ? "Todos esses karts já existem."
      : `${criados} kart(s) criado(s).`;
  });
}

export async function salvarModeloVinculoAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await salvarModeloDeVinculo(
      textoDoForm(dados, "modelo") as ModeloVinculo,
      ator,
    );
    return "Modelo de vínculo salvo.";
  });
}

// Tela Pista: liga de uma vez os sensores lidos aos karts (campo "kart:<sensor>" = número do
// kart; vazio = reserva). Usa as mesmas regras e a mesma auditoria do cadastro de karts; se algum
// número estiver errado, nada é gravado.
export async function vincularSensoresEmLoteAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const pedidos: PedidoDeVinculo[] = [];
    for (const [chave, valor] of dados.entries()) {
      if (!chave.startsWith("kart:") || typeof valor !== "string") continue;
      pedidos.push({ codigo: chave.slice(5), numero: valor });
    }
    const karts = (await listarKarts()).map((k) => ({
      id: k.id,
      numero: k.numero,
      sensor: k.transponderFixo,
    }));
    const plano = planejarVinculos(pedidos, karts);
    if (plano.erros.length) throw new ErroNegocio(plano.erros.join(" "));
    const total = plano.ligar.length + plano.criar.length;
    if (total === 0) {
      throw new ErroNegocio(
        "Informe o número do kart de pelo menos um sensor.",
      );
    }
    for (const l of plano.ligar) {
      await adicionarSensorAoKart(
        l.kartId,
        l.codigo,
        { substituir: false },
        ator,
      );
    }
    for (const c of plano.criar) {
      await salvarKart(
        null,
        { numero: c.numero, status: "ativo", transponderFixo: c.codigo },
        ator,
      );
    }
    const reserva = plano.reserva.length
      ? ` ${plano.reserva.length} de reserva.`
      : "";
    return `${total} sensor(es) vinculado(s).${reserva}`;
  });
}

// Adiciona um sensor novo ao kart (ex.: o sensor antigo deu problema).
export async function adicionarSensorAoKartAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const sensor =
      textoDoForm(dados, "sensor") || textoDoForm(dados, "sensorDigitado");
    const substituir = textoDoForm(dados, "substituir") === "1";
    await adicionarSensorAoKart(
      textoDoForm(dados, "kartId"),
      sensor,
      { substituir, motivo: textoDoForm(dados, "motivo") },
      ator,
    );
    return substituir
      ? "Sensor novo no kart; o anterior saiu de uso (em manutenção)."
      : "Sensor adicionado ao kart.";
  });
}

export async function removerSensorDoKartAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await removerSensorDoKart(
      textoDoForm(dados, "kartId"),
      textoDoForm(dados, "sensor"),
      textoDoForm(dados, "motivo"),
      ator,
    );
    return "Sensor tirado de uso (continua no histórico do kart).";
  });
}

// ---- Computador da pista (agente que vigia o que está ligado) ----

// A assinatura (estado anterior e formulário) é a exigida pelas ações dos
// formulários; esta ação não usa nenhum dos dois.
export async function criarPareamentoAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _anterior: AcaoState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const { codigo } = await criarPareamento(ator);
    return `Código: ${codigo} (vale 15 minutos, uso único).`;
  });
}

export async function registrarBaseAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    const n = await registrarBase(textoDoForm(dados, "computadorId"), ator);
    return `Registrado: ${n} dispositivo(s) já ligados. Conecte o decoder agora.`;
  });
}

export async function confirmarDecoderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await confirmarDecoder(
      textoDoForm(dados, "computadorId"),
      textoDoForm(dados, "chave"),
      textoDoForm(dados, "nome"),
      ator,
    );
    return "Decoder confirmado. Ele será reconhecido sozinho nas próximas vezes.";
  });
}

export async function esquecerDecoderAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await esquecerDecoder(textoDoForm(dados, "chave"), ator);
    return "Perfil do decoder removido.";
  });
}

export async function revogarComputadorAction(
  _anterior: AcaoState,
  dados: FormData,
): Promise<AcaoState> {
  return executarAcao("equipamento.administrar", async (ator) => {
    await revogarComputador(textoDoForm(dados, "computadorId"), ator);
    return "Computador desligado do sistema.";
  });
}
