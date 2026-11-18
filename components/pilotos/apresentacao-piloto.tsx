"use client";

import { efeitosReduzidos } from "@/components/ui/efeitos";
import { useEffect, useRef, useState } from "react";
import {
  ALTURA,
  DURACAO,
  LARGURA,
  QUADRO_PREVIA,
  carregarImagem,
  desenharQuadro,
  gravarVideo,
  type DadosApresentacao,
  type Recursos,
} from "@/lib/video-piloto/apresentacao";

// Vídeo de apresentação do piloto: prévia animada na tela e, para o admin, o download do arquivo
// (MP4 ou WebM, 1920x1080). Com `parado`, mostra só o quadro final (usado no cadastro).
export function ApresentacaoPiloto({
  dados,
  fotoUrl,
  podeBaixar = false,
  parado = false,
  nomeArquivo = "apresentacao-piloto",
}: {
  dados: DadosApresentacao;
  fotoUrl: string | null;
  podeBaixar?: boolean;
  parado?: boolean;
  nomeArquivo?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recursos = useRef<Recursos | null>(null);
  const dadosRef = useRef(dados);
  const [pronto, setPronto] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [gravando, setGravando] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    dadosRef.current = dados;
  }, [dados]);

  // Carrega a logo e o recorte do piloto.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [logo, corpo] = await Promise.all([
          carregarImagem("/logo-gridlap-claro.svg"),
          fotoUrl ? carregarImagem(fotoUrl) : Promise.resolve(null),
        ]);
        if (!vivo) return;
        recursos.current = { logo, corpo };
        setPronto(true);
      } catch {
        if (vivo) setErro("Não foi possível carregar a apresentação.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [fotoUrl]);

  // Toca (ou desenha o quadro final quando parado).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!pronto || !canvas || !ctx || !recursos.current) return;
    const r = recursos.current;
    const reduzido = efeitosReduzidos();
    if (parado || reduzido) {
      let quadro = 0;
      const desenhar = () => {
        desenharQuadro(ctx, QUADRO_PREVIA, dadosRef.current, r);
        quadro = requestAnimationFrame(desenhar);
      };
      desenhar();
      return () => cancelAnimationFrame(quadro);
    }
    const inicio = performance.now();
    let quadro = 0;
    const passo = () => {
      const t = Math.min(DURACAO, (performance.now() - inicio) / 1000);
      desenharQuadro(ctx, t, dadosRef.current, r);
      if (t < DURACAO) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [pronto, parado, rodada]);

  async function baixar() {
    if (!recursos.current || gravando !== null) return;
    setErro("");
    setGravando(0);
    try {
      const { blob, extensao } = await gravarVideo(
        dadosRef.current,
        recursos.current,
        setGravando,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nomeArquivo}.${extensao}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível gerar o vídeo.",
      );
    } finally {
      setGravando(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={LARGURA}
        height={ALTURA}
        role="img"
        aria-label={`Apresentação do piloto ${dados.nome}, número ${dados.numero}`}
        className="aspect-video w-full rounded-lg border border-white/10 bg-black"
      />
      {!parado || podeBaixar ? (
        <div className="flex flex-wrap items-center gap-3">
          {!parado ? (
            <button
              type="button"
              onClick={() => setRodada((n) => n + 1)}
              className="rounded-md border border-[#4cc9ff] px-4 py-2 text-sm font-medium text-[#4cc9ff] hover:bg-[#4cc9ff]/10"
            >
              Rever
            </button>
          ) : null}
          {podeBaixar ? (
            <button
              type="button"
              onClick={baixar}
              disabled={!pronto || gravando !== null}
              className="rounded-md bg-[#2b6ef5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d55d6] disabled:opacity-60"
            >
              {gravando !== null
                ? `Gerando vídeo… ${Math.round(gravando * 100)}%`
                : "Baixar vídeo"}
            </button>
          ) : null}
          {gravando !== null ? (
            <span className="text-xs text-[#9fb2d4]">
              Mantenha esta aba aberta durante os {DURACAO} segundos.
            </span>
          ) : null}
        </div>
      ) : null}
      {erro ? (
        <p role="alert" className="text-sm text-[#ff8da1]">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
