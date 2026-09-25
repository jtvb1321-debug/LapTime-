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
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (linha: T) => string;
  vazio?: string;
  // Opcional — dá pra destacar uma linha (ex.: volta mais rápida ao vivo)
  // sem mexer no visual das tabelas que não passam essa prop.
  linhaClassName?: (linha: T) => string | undefined;
}) {
  if (linhas.length === 0) {
    return (
      <div className="border-border bg-surface text-ink-2 rounded-lg border px-5 py-10 text-center text-sm">
        {vazio}
      </div>
    );
  }

  return (
    <div className="border-border bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-border text-ink-3 border-b text-xs tracking-wide uppercase">
            {colunas.map((coluna) => (
              <th
                key={coluna.header}
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
                "border-border hover:bg-ink/[0.02] border-b last:border-0",
                linhaClassName?.(linha),
              )}
            >
              {colunas.map((coluna) => (
                <td
                  key={coluna.header}
                  className={clsx(
                    "text-ink px-4 py-3",
                    coluna.numerica && "text-right font-mono",
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
