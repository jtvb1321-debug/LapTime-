import { avancarCorridas } from "@/lib/cronometragem/corridas-store";
import { purgarDiagnosticos } from "@/lib/cronometragem/decoders-store";

// Temporizador do SERVIDOR para as corridas: a cada segundo confere se algum
// tempo acabou e aplica a regra de encerramento configurada. O estado vive no
// banco (prazo = início + duração), então uma reinicialização não perde nada:
// ao subir, o próximo ciclo retoma a corrida de onde ela está.
type Global = typeof globalThis & { __gridlapRelogio?: boolean };

export function iniciarRelogioDeCorridas(): void {
  const g = globalThis as Global;
  if (g.__gridlapRelogio) return;
  g.__gridlapRelogio = true;

  let rodando = false;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      await avancarCorridas();
    } catch (erro) {
      console.error("[cronometragem] relógio das corridas falhou:", erro);
    } finally {
      rodando = false;
    }
  }, 1000).unref?.();

  // Diagnósticos antigos (eventos rejeitados e de conexão): uma vez por dia.
  const limpar = async () => {
    try {
      const n = await purgarDiagnosticos();
      if (n > 0)
        console.log(
          `[cronometragem] ${n} diagnóstico(s) antigo(s) apagado(s).`,
        );
    } catch (erro) {
      console.error("[cronometragem] limpeza de diagnósticos falhou:", erro);
    }
  };
  setTimeout(limpar, 60_000).unref?.();
  setInterval(limpar, 24 * 3_600_000).unref?.();
}
