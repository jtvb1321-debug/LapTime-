import { clsx } from "clsx";

export interface Coluna<T> {
  header: string;
  cell: (linha: T) => React.ReactNode;
  className?: string;
  numerica?: boolean;
}

export function DataTable<T>({
  colunas,
  linhas,
  chave,
  vazio = "Nenhum registro encontrado.",
  linhaClassName,
  rotulo = "Tabela de dados",
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (linha: T) => string;
  vazio?: string;
  // Opcional — dá pra destacar uma linha (ex.: volta mais rápida ao vivo)
  // sem mexer no visual das tabelas que não passam essa prop.
  linhaClassName?: (linha: T) => string | undefined;
  // Nome da região rolável (leitores de tela); a região recebe foco do teclado.
  rotulo?: string;
}) {
  if (linhas.length === 0) {
    return (
      <div className="border-border bg-surface text-ink-2 rounded-lg border px-5 py-10 text-center text-sm">
        {vazio}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={rotulo}
      tabIndex={0}
      className="border-border bg-surface overflow-x-auto rounded-lg border shadow-[var(--sombra-card)]"
    >
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-border bg-bg text-ink-3 border-b text-xs tracking-wide uppercase">
            {colunas.map((coluna) => (
              <th
                key={coluna.header}
                scope="col"
                className={clsx(
                  "px-4 py-3 font-medium",
                  coluna.numerica && "text-right",
                  coluna.className,
                )}
              >
                {coluna.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={chave(linha)}
              className={clsx(
                "border-border hover:bg-orange/[0.04] border-b last:border-0",
                linhaClassName?.(linha),
              )}
            >
              {colunas.map((coluna) => (
                <td
                  key={coluna.header}
                  className={clsx(
                    "text-ink px-4 py-3",
                    coluna.numerica &&
                      "font-display text-right text-base font-semibold",
                    coluna.className,
                  )}
                >
                  {coluna.cell(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
