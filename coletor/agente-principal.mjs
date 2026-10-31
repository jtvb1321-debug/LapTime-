import {
  AJUDA,
  argumentos,
  criarAgente,
  esperarEnter,
  instalarInicio,
  perguntar,
  removerInicio,
} from "./agente-nucleo.mjs";

// Roteia os comandos do agente. Sem comando e em modo "interativo" (duplo
// clique no .exe), conduz a primeira configuração e começa a vigiar.
// Devolve o código de saída.
export async function rodarAgente(
  args,
  { pasta, comandoDeInicio, interativo },
) {
  const agente = criarAgente(pasta);
  const { opcoes, posicionais } = argumentos(args);
  const [comando, ...resto] = posicionais;

  try {
    if (comando === "parear") {
      if (!resto[0] || !opcoes.servidor) {
        console.log(AJUDA);
        return 1;
      }
      await agente.parear(
        resto[0],
        String(opcoes.servidor),
        typeof opcoes.nome === "string" ? opcoes.nome : "",
      );
      console.log("Agora rode o agente (sem argumentos, ou o comando rodar).");
      return 0;
    }
    if (comando === "rodar") {
      await agente.rodar(opcoes.intervalo);
      return 0;
    }
    if (comando === "ver") {
      await agente.ver();
      return 0;
    }
    if (comando === "iniciar-com-windows") {
      console.log(`Pronto: ${instalarInicio(comandoDeInicio, pasta)}`);
      return 0;
    }
    if (comando === "remover-inicio") {
      console.log(
        removerInicio() ? "Início automático desfeito." : "Nada para desfazer.",
      );
      return 0;
    }
    if (comando || opcoes.ajuda || (!interativo && !comando)) {
      console.log(AJUDA);
      return comando ? 1 : 0;
    }

    // Duplo clique: primeira vez configura; depois só vigia.
    console.log("=== Grid Lap · Agente do computador da pista ===\n");
    if (!agente.lerConfig()) {
      console.log(
        "Primeira vez neste computador: vamos ligá-lo ao sistema.\n" +
          "No sistema, abra Cronometragem → Equipamentos → Computador da pista\n" +
          "e clique em 'Gerar código de pareamento'.\n",
      );
      for (;;) {
        const servidor = await perguntar(
          "Endereço do sistema (ex.: https://gridlap.exemplo.com.br)",
        );
        const codigo = await perguntar("Código de pareamento (ex.: ABCD-EFGH)");
        const nome = await perguntar(
          "Nome deste computador",
          process.env.COMPUTERNAME || "PC da pista",
        );
        try {
          await agente.parear(codigo, servidor, nome);
          break;
        } catch (erro) {
          console.log(`\nNão deu certo: ${erro.message}`);
          console.log(
            "Confira o endereço e o código (vale 15 minutos) e tente de novo.\n",
          );
        }
      }
      if (process.platform === "win32") {
        const sim = await perguntar(
          "\nIniciar o agente junto com o Windows? (s/N)",
          "n",
        );
        if (/^s/i.test(sim)) {
          console.log(`Pronto: ${instalarInicio(comandoDeInicio, pasta)}`);
        }
      }
    }
    console.log(
      "\nAgora conecte o decoder a este computador. Ele vai aparecer na tela\n" +
        "do sistema (Equipamentos → Computador da pista). Não feche esta janela.\n" +
        `O registro fica em ${agente.arquivoLog}\n`,
    );
    await agente.rodar(8);
    return 0;
  } catch (erro) {
    console.error(`\nErro: ${erro.message}`);
    if (interativo) await esperarEnter();
    return 1;
  }
}
