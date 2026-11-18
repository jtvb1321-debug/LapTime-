// Roda uma vez quando o servidor Next sobe:
//  1. aplica as migrações pendentes do banco e importa os arquivos JSON
//     antigos (uma única vez);
//  2. reaplica a simulação (ligada ou desligada) salva em
//     .data/simulacao.json.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { bancoConfigurado } = await import("@/lib/db/conexao");
  if (bancoConfigurado()) {
    const { migrarComRelatorio } = await import("@/lib/db/migrar");
    const { importarJsonLegado } = await import("@/lib/db/importar-json");

    // O banco pode demorar uns segundos pra aceitar conexões: tenta de novo
    // antes de desistir (e então falha alto, visível no log do container).
    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= 10; tentativa++) {
      try {
        const { aplicadas: novas, estruturaisPendentes } =
          await migrarComRelatorio();
        if (novas.length) console.log("[db] migrações aplicadas:", novas);
        if (estruturaisPendentes.length) {
          console.warn(
            "[db] migrações estruturais NÃO aplicadas (proteção ativa):",
            estruturaisPendentes,
          );
        }
        const importadas = await importarJsonLegado();
        for (const i of importadas) {
          console.log(`[db] importado ${i.arquivo}: ${i.linhas} registro(s)`);
        }
        ultimoErro = undefined;
        break;
      } catch (erro) {
        ultimoErro = erro;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
    if (ultimoErro) throw ultimoErro;

    // Relógio das corridas (tempo esgotado, encerramento) no servidor.
    const { iniciarRelogioDeCorridas } =
      await import("@/lib/cronometragem/relogio");
    iniciarRelogioDeCorridas();
  } else {
    console.warn(
      "[db] DATABASE_URL não configurada — recursos de banco indisponíveis.",
    );
  }

  const { garantirEstadoSimulacao } = await import("@/lib/simulacao");
  garantirEstadoSimulacao();
}
