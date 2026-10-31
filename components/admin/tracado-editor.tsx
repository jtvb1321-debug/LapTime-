"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Pista3D, type ControlePista3D } from "@/components/tracado/pista-3d";
import type { ModoCena, ResumoDaRota } from "@/lib/tracado3d/cena-pista";
import {
  MAX_ARQUIVO_BYTES,
  lerArquivo,
  paraArquivo,
  type PontoRota,
} from "@/lib/tracado3d/rota";
import { ROTA_EXEMPLO } from "@/lib/tracado3d/rota-exemplo";

export interface RotaEditada {
  pontos: PontoRota[];
  fechado: boolean;
  // Trechos fora do asfalto; 0 só vale depois do modelo carregado.
  invalidos: number;
  metros: number;
  pronto: boolean;
}

interface Estado {
  pontos: PontoRota[];
  fechado: boolean;
}

const MODOS: { id: ModoCena; rotulo: string; dica: string }[] = [
  {
    id: "criar",
    rotulo: "Criar",
    dica: "Clique no asfalto para adicionar pontos. As curvas passam pelos pontos em ordem.",
  },
  {
    id: "editar",
    rotulo: "Editar",
    dica: "Arraste os pontos verdes. Selecione um ponto para excluir ou mudar sua ordem.",
  },
  {
    id: "navegar",
    rotulo: "Navegar",
    dica: "Arraste para girar; use a roda para zoom e o botão direito para mover a vista.",
  },
];

// Editor de traçado em 3D sobre o modelo do kartódromo: o admin clica em
// pontos no asfalto, em ordem (vários em cada curva), e o editor liga os
// pontos com uma curva suave e avisa onde ela sai da pista.
export function TracadoEditor({
  inicial,
  nomeDoArquivo = "tracado",
  onChange,
}: {
  inicial?: Estado;
  nomeDoArquivo?: string;
  onChange: (rota: RotaEditada) => void;
}) {
  const controle = useRef<ControlePista3D>(null);
  const [pontos, setPontos] = useState<PontoRota[]>(inicial?.pontos ?? []);
  const [fechado, setFechado] = useState(inicial?.fechado ?? false);
  const [selecionado, setSelecionado] = useState(-1);
  const [modo, setModo] = useState<ModoCena>("criar");
  const [historico, setHistorico] = useState<Estado[]>([]);
  const [visaoPiloto, setVisaoPiloto] = useState(false);
  const [reproduzindo, setReproduzindo] = useState(false);
  const [velocidade, setVelocidade] = useState(30);
  const [distancia, setDistancia] = useState(0);
  const [resumo, setResumo] = useState<ResumoDaRota>({
    total: 0,
    invalidos: 0,
  });
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState("");

  const emOnChange = useRef(onChange);
  useEffect(() => {
    emOnChange.current = onChange;
  });
  useEffect(() => {
    emOnChange.current({
      pontos,
      fechado,
      invalidos: resumo.invalidos,
      metros: resumo.total,
      pronto,
    });
  }, [pontos, fechado, resumo, pronto]);

  const aoResumir = useCallback((r: ResumoDaRota) => setResumo(r), []);

  function guardar() {
    setHistorico((h) => [...h.slice(-79), { pontos, fechado }]);
  }
  function parar() {
    setReproduzindo(false);
    setDistancia(0);
  }
  function mudar(novos: PontoRota[], sel = -1) {
    guardar();
    setPontos(novos);
    setSelecionado(sel);
    setAviso("");
    parar();
  }

  function desfazer() {
    const anterior = historico[historico.length - 1];
    if (!anterior) return;
    setHistorico((h) => h.slice(0, -1));
    setPontos(anterior.pontos);
    setFechado(anterior.fechado);
    setSelecionado(-1);
    parar();
  }
  function escolherModo(m: ModoCena) {
    setVisaoPiloto(false);
    setReproduzindo(false);
    setModo(m);
  }
  function excluir() {
    if (selecionado < 0) return;
    mudar(
      pontos.filter((_, i) => i !== selecionado),
      Math.min(selecionado, pontos.length - 2),
    );
  }
  function mover(i: number, direcao: -1 | 1) {
    const novos = [...pontos];
    [novos[i], novos[i + direcao]] = [novos[i + direcao], novos[i]];
    mudar(novos, i + direcao);
  }
  function limpar() {
    if (pontos.length > 0 && !window.confirm("Limpar todos os pontos?")) return;
    mudar([]);
  }
  function carregarExemplo() {
    mudar(ROTA_EXEMPLO.map((p) => ({ ...p })));
    setFechado(false);
    controle.current?.enquadrar("topo");
  }
  function exportar() {
    const corpo = JSON.stringify(
      paraArquivo({ nome: nomeDoArquivo, fechado, pontos }),
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([corpo], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "tracado-velokart.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importar(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      if (arquivo.size > MAX_ARQUIVO_BYTES) {
        throw new Error("O arquivo deve ter até 500 KB.");
      }
      const rota = lerArquivo(JSON.parse(await arquivo.text()));
      guardar();
      setPontos(rota.pontos);
      setFechado(rota.fechado);
      setSelecionado(-1);
      setAviso("");
      parar();
    } catch (e) {
      setAviso(
        `Não foi possível abrir: ${e instanceof Error ? e.message : "arquivo inválido"}`,
      );
    }
  }

  function alternarReproducao() {
    if (resumo.invalidos > 0 || resumo.total === 0) return;
    if (!reproduzindo) setVisaoPiloto(true);
    setReproduzindo(!reproduzindo);
  }

  const podeAndar = pronto && pontos.length >= 2 && resumo.total > 0;
  const dica =
    aviso ||
    (resumo.invalidos > 0
      ? `${resumo.invalidos} trecho(s) fora da pista. Adicione pontos intermediários nas curvas ou arraste os pontos para corrigir.`
      : (MODOS.find((m) => m.id === modo)?.dica ?? ""));

  return (
    <div className="border-border bg-bg flex flex-col gap-3 rounded-lg border p-3">
      <div className="grid gap-3 lg:grid-cols-[18rem_1fr]">
        <div className="flex flex-col gap-3">
          <div
            role="group"
            aria-label="Modo de edição"
            className="grid grid-cols-3 gap-1"
          >
            {MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={modo === m.id}
                onClick={() => escolherModo(m.id)}
                className={clsx(
                  "min-h-11 rounded-md border px-2 text-sm font-medium md:min-h-9",
                  modo === m.id
                    ? "border-orange bg-orange text-on-orange"
                    : "border-border-strong bg-surface text-ink hover:border-orange",
                )}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={desfazer}
              disabled={historico.length === 0}
            >
              Desfazer
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => mudar([...pontos].reverse())}
              disabled={pontos.length < 2}
            >
              Inverter
            </Button>
          </div>
          <label className="text-ink flex min-h-11 items-center gap-2 text-sm md:min-h-0">
            <input
              type="checkbox"
              checked={fechado}
              onChange={(e) => {
                guardar();
                setFechado(e.target.checked);
                parar();
              }}
              className="size-4"
            />
            Fechar circuito (liga o último ponto ao primeiro)
          </label>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="border-border bg-surface rounded-md border p-2">
              <p className="text-ink font-mono text-lg font-semibold">
                {pontos.length}
              </p>
              <p className="text-ink-3 text-xs uppercase">Pontos</p>
            </div>
            <div className="border-border bg-surface rounded-md border p-2">
              <p className="text-ink font-mono text-lg font-semibold">
                {resumo.total.toFixed(0)} m
              </p>
              <p className="text-ink-3 text-xs uppercase">Distância estimada</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-ink text-sm font-medium">Pontos do percurso</p>
            <button
              type="button"
              onClick={excluir}
              disabled={selecionado < 0}
              className="text-danger min-h-11 px-2 text-xs font-medium hover:underline disabled:opacity-40 md:min-h-0"
            >
              Excluir ponto
            </button>
          </div>
          <ol className="border-border bg-surface max-h-52 overflow-y-auto rounded-md border">
            {pontos.length === 0 ? (
              <li className="text-ink-3 p-3 text-sm">
                Nenhum ponto ainda. Use Criar e clique no asfalto.
              </li>
            ) : (
              pontos.map((p, i) => (
                <li
                  key={i}
                  className={clsx(
                    "border-border flex items-center border-b last:border-b-0",
                    i === selecionado && "bg-orange/10",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelecionado(i)}
                    aria-current={i === selecionado}
                    className="text-ink min-h-11 flex-1 px-3 text-left font-mono text-xs md:min-h-8"
                  >
                    {String(i + 1).padStart(2, "0")} · {p.x.toFixed(1)},{" "}
                    {p.z.toFixed(1)}
                  </button>
                  {([-1, 1] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={i + d < 0 || i + d >= pontos.length}
                      aria-label={`Mover ponto ${i + 1} para ${d < 0 ? "cima" : "baixo"}`}
                      onClick={() => mover(i, d)}
                      className="text-ink-2 size-11 text-sm disabled:opacity-30 md:size-8"
                    >
                      {d < 0 ? "↑" : "↓"}
                    </button>
                  ))}
                </li>
              ))
            )}
          </ol>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={carregarExemplo}>
              Carregar exemplo
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={exportar}
              disabled={pontos.length === 0}
            >
              Exportar JSON
            </Button>
            <label className="border-border-strong bg-surface text-ink hover:border-orange inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium md:min-h-9">
              Importar JSON
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={(e) => {
                  void importar(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <Button type="button" variant="ghost" onClick={limpar}>
              Limpar
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Pista3D
              className="h-80 w-full rounded-md sm:h-[26rem]"
              controle={controle}
              pontos={pontos}
              fechado={fechado}
              selecionado={selecionado}
              modo={modo}
              visaoPiloto={visaoPiloto}
              reproduzindo={reproduzindo}
              velocidadeKmh={velocidade}
              onPronto={() => setPronto(true)}
              onResumo={aoResumir}
              onAdicionar={(p) => {
                const indice =
                  selecionado >= 0 ? selecionado + 1 : pontos.length;
                const novos = [...pontos];
                novos.splice(indice, 0, p);
                mudar(novos, indice);
              }}
              onIniciarArraste={() => {
                guardar();
                parar();
              }}
              onMover={(i, p) =>
                setPontos((atuais) => atuais.map((q, j) => (j === i ? p : q)))
              }
              onSelecionar={setSelecionado}
              onProgresso={(d) => setDistancia(d)}
              onFim={() => setReproduzindo(false)}
              onAviso={setAviso}
            />
            <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-1">
              {(
                [
                  ["Vista superior", "topo"],
                  ["Perspectiva", "perspectiva"],
                ] as const
              ).map(([rotulo, vista]) => (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => {
                    setVisaoPiloto(false);
                    setReproduzindo(false);
                    controle.current?.enquadrar(vista);
                  }}
                  className="bg-graphite/85 hover:bg-graphite min-h-11 rounded-md px-3 text-xs font-medium text-white md:min-h-8"
                >
                  {rotulo}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={visaoPiloto}
                disabled={!podeAndar}
                onClick={() => {
                  setVisaoPiloto(!visaoPiloto);
                  if (visaoPiloto) setReproduzindo(false);
                }}
                className={clsx(
                  "min-h-11 rounded-md px-3 text-xs font-medium disabled:opacity-40 md:min-h-8",
                  visaoPiloto
                    ? "bg-orange text-on-orange"
                    : "bg-graphite/85 hover:bg-graphite text-white",
                )}
              >
                Visão do piloto
              </button>
            </div>
            <div
              role="status"
              aria-live="polite"
              className="bg-graphite/85 absolute right-2 bottom-2 left-2 rounded-md px-3 py-2 text-xs text-white"
            >
              {dica}
              <span className="ml-3 whitespace-nowrap text-white/80">
                <i className="mr-1 inline-block h-2 w-4 rounded-sm bg-[#00b879] align-middle" />
                Rota
                <i className="mr-1 ml-2 inline-block h-2 w-4 rounded-sm bg-[#e84d42] align-middle" />
                Fora da pista
              </span>
            </div>
          </div>

          <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-md border p-2">
            <Button
              type="button"
              onClick={alternarReproducao}
              disabled={!podeAndar || resumo.invalidos > 0}
            >
              {reproduzindo ? "Pausar" : "Iniciar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                parar();
                controle.current?.reiniciar();
              }}
              disabled={!podeAndar}
            >
              Reiniciar
            </Button>
            <label className="text-ink-2 flex items-center gap-2 text-xs">
              Velocidade
              <input
                type="range"
                min={5}
                max={90}
                value={velocidade}
                onChange={(e) => setVelocidade(Number(e.target.value))}
              />
              <b className="text-ink w-14 font-mono">{velocidade} km/h</b>
            </label>
            <div
              className="bg-border h-1.5 min-w-24 flex-1 overflow-hidden rounded-full"
              aria-hidden
            >
              <div
                className="bg-orange h-full"
                style={{
                  width: `${resumo.total ? (100 * Math.min(distancia, resumo.total)) / resumo.total : 0}%`,
                }}
              />
            </div>
            <span className="text-ink-2 font-mono text-xs">
              {distancia.toFixed(0)} / {resumo.total.toFixed(0)} m
            </span>
          </div>
        </div>
      </div>
      <p className="text-ink-3 text-xs">
        Escala e distâncias são estimadas a partir do modelo 3D; servem de
        referência, não de medição oficial.
      </p>
    </div>
  );
}
