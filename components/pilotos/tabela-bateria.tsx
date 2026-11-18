import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import type { LinhaClassificacao } from "@/lib/cronometragem/motor";

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Marca a linha do próprio piloto pelo nome (melhor esforço: o cronômetro identifica o participante
// pelo nome cadastrado na bateria, que pode não ser idêntico ao do cadastro do campeonato).
export function ehLinhaDoPiloto(nome: string, meus: string[]) {
  const n = normalizar(nome);
  return n.length > 0 && meus.some((m) => normalizar(m) === n);
}

const situacoes: Record<string, string> = {
  dnf: "DNF",
  dns: "DNS",
  dsq: "DSQ",
};

// Classificação de uma bateria, só leitura: posição, piloto, kart, voltas e tempos. Não traz nenhum
// dado de contato ou de pagamento.
export function TabelaBateria({
  linhas,
  meus,
}: {
  linhas: LinhaClassificacao[];
  meus: string[];
}) {
  if (linhas.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-[#9fb2d4]">
        Ainda não há voltas registradas.
      </p>
    );
  }
  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label="Classificação da bateria"
      tabIndex={0}
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs tracking-wide text-[#9fb2d4] uppercase">
            <th scope="col" className="px-3 py-2 font-medium">
              Pos.
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Piloto
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Kart
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Voltas
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Melhor volta
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Última
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const meu = ehLinhaDoPiloto(l.nome, meus);
            return (
              <tr
                key={l.participanteId}
                className={`border-b border-white/5 last:border-0 ${
                  meu ? "bg-[#4cc9ff]/10" : ""
                }`}
              >
                <td className="px-3 py-2 font-semibold">
                  {l.posicao ?? "—"}
                  {situacoes[l.situacao] ? (
                    <span className="ml-1 text-xs text-[#ffcf4a]">
                      {situacoes[l.situacao]}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {l.nome}
                  {meu ? (
                    <span className="ml-2 rounded-full bg-[#4cc9ff]/20 px-2 py-0.5 text-[10px] text-[#4cc9ff]">
                      você
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">{l.kartNumero ?? "—"}</td>
                <td className="px-3 py-2 text-right">{l.voltas}</td>
                <td className="px-3 py-2 text-right">
                  {l.melhorVoltaMs ? formatarTempoVolta(l.melhorVoltaMs) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {l.ultimaVoltaMs ? formatarTempoVolta(l.ultimaVoltaMs) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
