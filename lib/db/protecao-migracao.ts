// Proteção contra migrações estruturais indevidas.
//
// As migrações aprovadas até hoje (as que já existem em lib/db/migracoes.ts)
// continuam sendo aplicadas sozinhas na subida do servidor, como sempre foram.
// Uma migração marcada como `estrutural` (módulo do campeonato e seguintes)
// NÃO roda sozinha em nenhum banco. Só roda quando TODAS as condições abaixo
// valem ao mesmo tempo:
//
//   1. GRIDLAP_AMBIENTE=desenvolvimento
//   2. GRIDLAP_MIGRAR_ESTRUTURAL=1
//   3. NODE_ENV diferente de "production"
//   4. DATABASE_URL aponta para esta máquina (127.0.0.1, localhost ou ::1)
//   5. o nome do banco é de desenvolvimento: gridlap_dev ou gridlap_dev_<algo>
//   6. a porta não é a do túnel para o servidor (55432)
//
// A regra 5 existe porque o túnel SSH também aparece como 127.0.0.1: só o
// host não diferencia o banco local do banco do servidor.

export interface Avaliacao {
  permitido: boolean;
  motivos: string[];
}

const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const PORTA_DO_TUNEL = "55432";
const BANCO_DE_DESENVOLVIMENTO = /^gridlap_dev(_[a-z0-9]+)?$/;

export function avaliarMigracaoEstrutural(
  env: Record<string, string | undefined>,
): Avaliacao {
  const motivos: string[] = [];

  if (env.GRIDLAP_AMBIENTE !== "desenvolvimento") {
    motivos.push("GRIDLAP_AMBIENTE não é “desenvolvimento”.");
  }
  if (env.GRIDLAP_MIGRAR_ESTRUTURAL !== "1") {
    motivos.push("GRIDLAP_MIGRAR_ESTRUTURAL não está ligada (=1).");
  }
  if (env.NODE_ENV === "production") {
    motivos.push("NODE_ENV é “production”.");
  }

  const url = env.DATABASE_URL;
  if (!url) {
    motivos.push("DATABASE_URL não está definida.");
  } else {
    let endereco: URL | null = null;
    try {
      endereco = new URL(url);
    } catch {
      motivos.push("DATABASE_URL inválida.");
    }
    if (endereco) {
      if (!HOSTS_LOCAIS.has(endereco.hostname)) {
        motivos.push(`O banco não é desta máquina (${endereco.hostname}).`);
      }
      if (endereco.port === PORTA_DO_TUNEL) {
        motivos.push(
          `A porta ${PORTA_DO_TUNEL} é a do túnel para o servidor remoto.`,
        );
      }
      const banco = decodeURIComponent(endereco.pathname.replace(/^\//, ""));
      if (!BANCO_DE_DESENVOLVIMENTO.test(banco)) {
        motivos.push(
          `O banco “${banco || "(sem nome)"}” não é de desenvolvimento (esperado gridlap_dev).`,
        );
      }
    }
  }

  return { permitido: motivos.length === 0, motivos };
}

export class MigracaoBloqueada extends Error {
  constructor(public readonly motivos: string[]) {
    super(
      `Migração estrutural bloqueada pela proteção do Grid Lap: ${motivos.join(" ")}`,
    );
    this.name = "MigracaoBloqueada";
  }
}
