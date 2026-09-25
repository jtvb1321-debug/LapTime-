import { Caveat } from "next/font/google";

// Fonte cursiva usada em toda "assinatura" pessoal do piloto (número +
// nome nas cores que ele escolheu) — simula que foi escrita à mão, tanto no
// selo de destaque (pole/volta rápida) quanto no fundo do perfil público.
export const fonteAssinatura = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});
