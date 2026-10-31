"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { assinarTermoAction } from "@/lib/termo-publico-actions";
import type { AcaoState } from "@/lib/operacao-actions";

const ESTADO_INICIAL: AcaoState = {};
const CLASSE_CAMPO =
  "border-border-strong bg-surface text-ink focus:border-orange w-full rounded-md border px-3 py-2 text-base outline-none";

const MINIMO_DE_TINTA = 150;

// Devolve o PNG da assinatura sobre fundo branco, ou null se o quadro está
// (praticamente) vazio.
function imagemDaAssinatura(canvas: HTMLCanvasElement | null): string | null {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let tinta = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) tinta += 1;
  if (tinta < MINIMO_DE_TINTA) return null;
  const final = document.createElement("canvas");
  final.width = canvas.width;
  final.height = canvas.height;
  const fctx = final.getContext("2d");
  if (!fctx) return null;
  fctx.fillStyle = "#ffffff";
  fctx.fillRect(0, 0, final.width, final.height);
  fctx.drawImage(canvas, 0, 0);
  return final.toDataURL("image/png");
}

// Quadro para desenhar a assinatura com o dedo (ou mouse) e o formulário do
// aceite. A imagem sai em PNG junto com o nome de quem assina.
export function AssinaturaDigital({
  token,
  termoVersao,
  nomeDoPiloto,
  menor,
}: {
  token: string;
  termoVersao: number;
  nomeDoPiloto: string;
  menor: boolean;
}) {
  const [estado, executar, pendente] = useActionState(
    assinarTermoAction,
    ESTADO_INICIAL,
  );
  const quadro = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  // Cliques repetidos em "Assinar" enviariam o mesmo termo várias vezes e a
  // última resposta ("já foi assinado") esconderia o sucesso.
  const emEnvio = useRef(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [outroAssina, setOutroAssina] = useState(menor);

  const preparar = useCallback(() => {
    const c = quadro.current;
    if (!c) return;
    const razao = window.devicePixelRatio || 1;
    const caixa = c.getBoundingClientRect();
    c.width = Math.round(caixa.width * razao);
    c.height = Math.round(caixa.height * razao);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(razao, razao);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  useEffect(() => {
    preparar();
  }, [preparar]);

  function posicao(e: PointerEvent<HTMLCanvasElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caixa.left, y: e.clientY - caixa.top };
  }

  function comecar(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  }

  function riscar(e: PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicao(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    desenhando.current = false;
  }

  function limpar() {
    const c = quadro.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setErroLocal(null);
  }

  useEffect(() => {
    if (estado.erro) emEnvio.current = false;
  }, [estado]);

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (emEnvio.current) return;
    const imagem = imagemDaAssinatura(quadro.current);
    if (!imagem) {
      setErroLocal("Desenhe a assinatura no quadro.");
      return;
    }
    setErroLocal(null);
    const dados = new FormData(evento.currentTarget);
    dados.set("assinatura", imagem);
    emEnvio.current = true;
    startTransition(() => executar(dados));
  }

  if (estado.ok) {
    return (
      <div
        role="status"
        className="border-border bg-surface rounded-lg border p-6 text-center"
      >
        <p className="text-ink text-lg font-semibold">{estado.ok}</p>
        <p className="text-ink-2 mt-2 text-sm">
          Seu termo ficou registrado. Pode voltar para a equipe do kartódromo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="termoVersao" value={termoVersao} />

      <label className="text-ink flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="leu"
          value="1"
          required
          className="mt-0.5 size-4"
        />
        <span>Li e concordo com o termo de responsabilidade acima.</span>
      </label>

      <label className="text-ink flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="porMenor"
          value="1"
          checked={outroAssina}
          disabled={menor}
          onChange={(e) => setOutroAssina(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          {menor
            ? `${nomeDoPiloto} é menor de 18 anos: assina o responsável legal.`
            : "Estou assinando como responsável legal de um menor de 18 anos."}
        </span>
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="assinante" className="text-ink text-sm font-medium">
          {outroAssina
            ? "Nome completo do responsável legal"
            : "Seu nome completo"}
        </label>
        <input
          id="assinante"
          name="assinante"
          required
          minLength={3}
          maxLength={120}
          autoComplete="name"
          defaultValue={outroAssina ? "" : nomeDoPiloto}
          key={outroAssina ? "responsavel" : "piloto"}
          className={CLASSE_CAMPO}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="documento" className="text-ink text-sm font-medium">
          CPF ou documento (opcional)
        </label>
        <input
          id="documento"
          name="documento"
          maxLength={30}
          inputMode="numeric"
          className={CLASSE_CAMPO}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-ink text-sm font-medium">
            Assine com o dedo no quadro
          </span>
          <button
            type="button"
            onClick={limpar}
            className="text-orange-ink text-sm font-medium"
          >
            Limpar
          </button>
        </div>
        <canvas
          ref={quadro}
          aria-label="Quadro de assinatura"
          onPointerDown={comecar}
          onPointerMove={riscar}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          className="border-border-strong h-44 w-full touch-none rounded-md border bg-white"
        />
      </div>

      {erroLocal || estado.erro ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {erroLocal ?? estado.erro}
        </p>
      ) : null}
      <Button type="submit" disabled={pendente}>
        {pendente ? "Registrando…" : "Assinar o termo"}
      </Button>
    </form>
  );
}
