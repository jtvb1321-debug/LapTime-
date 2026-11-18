import { fonteAssinatura } from "@/lib/fonts";

// "Assinatura" pessoal do piloto: número + nome nas cores que ele escolheu
// no cadastro, numa fonte cursiva (simula que foi escrito à mão) — aparece
// no lugar do selo genérico (Pole/VR) quando o piloto tem cores próprias
// definidas. Sem cores escolhidas, quem chama decide o que mostrar no lugar
// (ver usos em app/overlay/*).
export function AssinaturaPiloto({
  numero,
  nome,
  corNumero,
  corAssinatura,
  motivo,
}: {
  numero: number;
  nome: string;
  corNumero: string;
  corAssinatura: string;
  motivo: "pole" | "volta_rapida" | "vencedor";
}) {
  const rotulo = {
    pole: "Pole",
    volta_rapida: "Volta rápida",
    vencedor: "Vencedor",
  }[motivo];

  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-sm"
      style={{ borderColor: corNumero, backgroundColor: `${corNumero}22` }}
    >
      <span
        className={`${fonteAssinatura.className} text-xl leading-none font-bold`}
        style={{ color: corNumero }}
      >
        {numero}
      </span>
      <span
        className={`${fonteAssinatura.className} text-xl leading-none font-bold whitespace-nowrap`}
        style={{ color: corAssinatura }}
      >
        {nome}
      </span>
      <span className="text-[9px] leading-none font-semibold tracking-wide whitespace-nowrap text-white/50 uppercase">
        {rotulo}
      </span>
    </span>
  );
}
