import { Logo } from "@/components/ui/logo";
import {
  baterias,
  campeonato,
  etapas,
  formatGap,
  formatTempoVolta,
  getBateriaClassificatoriaDaFinal,
  getCategoriaById,
  getKartById,
  getPilotoById,
  getPole,
  getResultadosPorBateria,
  getTracadoById,
  getVoltaRapida,
  nomeExibicaoPiloto,
} from "@/lib/mock/data";

// Lê dados de corrida em tempo real (simulação liga/desliga) — nunca estática.
export const dynamic = "force-dynamic";

export default function TvPage() {
  // Enquanto os dados forem locais, a bateria exibida é fixa. Com o Supabase
  // conectado, a página assina o Realtime da tabela `resultados` da bateria
  // com status "ao_vivo" (ou a próxima "grid"/"agendada", se nenhuma estiver rolando).
  const bateria =
    baterias.find((b) => b.status === "ao_vivo") ??
    baterias.find((b) => b.status === "grid") ??
    baterias[0];

  if (!bateria) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10">
        <Logo variant="dark" />
        <p className="text-sm tracking-wide text-white/80">
          Nenhuma bateria cadastrada no momento.
        </p>
      </div>
    );
  }

  const etapa = etapas.find((e) => e.id === bateria.etapaId);
  const tracado = etapa?.tracadoId
    ? getTracadoById(etapa.tracadoId)
    : undefined;
  const categoria = getCategoriaById(bateria.categoriaId);
  const resultados = getResultadosPorBateria(bateria.id);
  const aoVivo = bateria.status === "ao_vivo";
  const classificatoria = getBateriaClassificatoriaDaFinal(bateria);
  const pole = classificatoria ? getPole(classificatoria.id) : undefined;
  const voltaRapida = getVoltaRapida(bateria.id);

  return (
    <div className="flex min-h-screen flex-col p-10">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <Logo variant="dark" />
          <p className="mt-2 text-sm tracking-wide text-white/80">
            {campeonato ? `${campeonato.nome} ${campeonato.temporada}` : null} —{" "}
            {etapa?.kartodromo}
            {tracado ? ` · ${tracado.nome}` : ""}
          </p>
          <h1 className="mt-1 text-3xl font-semibold lg:text-4xl">
            {categoria?.nome} — {bateria.nome}
          </h1>
          <p className="mt-2 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            Dados de demonstração (simulação do campeonato)
          </p>
        </div>
        {aoVivo ? (
          <div className="bg-orange text-on-orange flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            AO VIVO
          </div>
        ) : (
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/70">
            {bateria.status.replace("_", " ").toUpperCase()}
          </div>
        )}
      </header>

      <table className="mt-8 w-full font-mono text-2xl lg:text-4xl">
        <thead>
          <tr className="text-left text-sm tracking-wide text-white/70 uppercase">
            <th className="pb-3 pl-2">Pos.</th>
            <th className="pb-3">Piloto</th>
            <th className="pb-3">Kart</th>
            <th className="pb-3 text-right">Melhor volta</th>
            <th className="pr-2 pb-3 text-right">Gap</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((resultado) => {
            const piloto = getPilotoById(resultado.pilotoId);
            return (
              <tr key={resultado.id} className="border-t border-white/10">
                <td className="py-3 pl-2 text-white/80">
                  {resultado.posicao}º
                </td>
                <td className="py-3 font-sans font-medium">
                  <span className="flex items-center gap-2">
                    {piloto ? nomeExibicaoPiloto(piloto) : null}
                    {pole?.pilotoId === resultado.pilotoId ? (
                      <span className="bg-orange text-on-orange rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                        Pole
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="py-3 text-white/80">
                  {getKartById(resultado.kartId)?.placa}
                </td>
                <td className="py-3 text-right">
                  <span className="flex items-center justify-end gap-2">
                    {formatTempoVolta(resultado.melhorVoltaMs)}
                    {voltaRapida?.id === resultado.id ? (
                      <span className="bg-orange text-on-orange rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                        VR
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="text-orange py-3 pr-2 text-right">
                  {formatGap(resultado.gapMs)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
