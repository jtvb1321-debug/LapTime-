import { AutoAtualizar } from "@/components/cronometragem/auto-atualizar";
import { Logo } from "@/components/ui/logo";
import { NomeCategoria } from "@/components/ui/nome-categoria";
import { lerCampeonatoAtivo } from "@/lib/campeonatos-store";
import { formatarTempoVolta } from "@/lib/cronometragem/voltas";
import { overlayAoVivo, overlayResultado } from "@/lib/overlay-campeonato";
import { categorias } from "@/lib/mock/data";

// Dados reais do decoder, atualizados a cada 3 s: a bateria do campeonato que está rolando e,
// quando nada está rolando, o resultado da última corrida finalizada.
export const dynamic = "force-dynamic";

interface Linha {
  posicao: number;
  nome: string;
  kart: string;
  melhorVoltaMs: number;
  diferenca: string;
  voltaRapida: boolean;
}

export default async function TvPage() {
  const [campeonato, vivo, ultimo] = await Promise.all([
    lerCampeonatoAtivo(),
    overlayAoVivo(),
    overlayResultado(),
  ]);

  let titulo = "";
  let categoriaNome: string | null = null;
  let aoVivo = false;
  let linhas: Linha[] = [];
  let etapa: string | null = null;

  if (vivo.bateria) {
    aoVivo = true;
    categoriaNome = vivo.bateria.categoria;
    etapa = vivo.bateria.etapa;
    titulo = vivo.bateria.numero === 1 ? "Classificação" : "Corrida";
    linhas = vivo.pilotos.map((p) => ({
      posicao: p.posicao,
      nome: p.nome,
      kart: p.kartPlaca ?? "—",
      melhorVoltaMs: p.melhorVoltaMs,
      diferenca: p.gapTexto ?? "—",
      voltaRapida: p.voltaRapida,
    }));
  } else if (ultimo.corrida) {
    categoriaNome = ultimo.corrida.categoria;
    etapa = ultimo.corrida.etapa;
    titulo = "Resultado";
    const melhor = Math.min(
      ...ultimo.pilotos.map((p) => p.melhorVoltaMs).filter((m) => m > 0),
    );
    linhas = ultimo.pilotos.map((p) => ({
      posicao: p.posicao,
      nome: p.nome,
      kart: p.kartNumero !== null ? String(p.kartNumero) : "—",
      melhorVoltaMs: p.melhorVoltaMs,
      diferenca: p.gapTexto ?? "—",
      voltaRapida: p.melhorVoltaMs > 0 && p.melhorVoltaMs === melhor,
    }));
  }

  const categoria = categorias.find((c) => c.nome === categoriaNome);

  if (linhas.length === 0 && !aoVivo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 sm:p-10">
        <AutoAtualizar intervaloMs={5000} />
        <Logo variant="dark" />
        <p className="text-sm tracking-wide text-white/80">
          {campeonato
            ? `${campeonato.nome} ${campeonato.temporada}: nenhuma bateria rolando agora.`
            : "Nenhum campeonato ativo no momento."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-4 sm:p-10">
      <AutoAtualizar intervaloMs={3000} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-6">
        <div>
          <Logo variant="dark" />
          <p className="mt-2 text-sm tracking-wide text-white/80">
            {campeonato ? `${campeonato.nome} ${campeonato.temporada}` : null}
            {etapa ? ` — ${etapa}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl lg:text-4xl">
            {categoria ? (
              <NomeCategoria categoriaId={categoria.id}>
                {categoria.nome}
              </NomeCategoria>
            ) : (
              categoriaNome
            )}{" "}
            — {titulo}
          </h1>
        </div>
        {aoVivo ? (
          <div className="bg-orange text-on-orange flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            AO VIVO
          </div>
        ) : (
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/70">
            ÚLTIMO RESULTADO
          </div>
        )}
      </header>

      <div
        role="region"
        aria-label="Classificação"
        tabIndex={0}
        className="mt-8 overflow-x-auto"
      >
        <table className="font-display w-full text-lg sm:text-3xl lg:text-5xl">
          <thead>
            <tr className="text-left text-sm tracking-wide text-white/70 uppercase">
              <th className="pb-3 pl-2">Pos.</th>
              <th className="pb-3">Piloto</th>
              <th className="pb-3">Kart</th>
              <th className="pb-3 text-right">Melhor volta</th>
              <th className="pr-2 pb-3 text-right">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-6 text-center text-base text-white/70"
                >
                  Aguardando as primeiras passagens…
                </td>
              </tr>
            ) : null}
            {linhas.map((l) => (
              <tr
                key={`${l.posicao}-${l.nome}`}
                className="border-t border-white/10"
              >
                <td className="py-3 pl-2 text-white/80">{l.posicao}º</td>
                <td className="py-3 font-sans font-medium">{l.nome}</td>
                <td className="py-3 text-white/80">{l.kart}</td>
                <td className="py-3 text-right">
                  <span className="flex items-center justify-end gap-2">
                    {l.melhorVoltaMs > 0
                      ? formatarTempoVolta(l.melhorVoltaMs)
                      : "—"}
                    {l.voltaRapida ? (
                      <span className="bg-orange text-on-orange rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                        VR
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="text-orange py-3 pr-2 text-right">
                  {l.posicao === 1 ? "—" : l.diferenca}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
