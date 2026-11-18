import Image from "next/image";

const RECURSOS = [
  "Passagens e voltas em tempo real, sem digitar nada",
  "Karts e sensores cadastrados em poucos toques",
  "Classificação com melhor volta, 2ª melhor e diferenças",
  "Baterias e campeonatos no mesmo lugar",
  "Resultado oficial pronto para imprimir",
];

// Apresentação pública da cronometragem. A imagem é uma captura do painel com
// dados fictícios.
export function SecaoCronometragem() {
  return (
    <section
      aria-labelledby="cronometragem-titulo"
      className="border-border bg-surface grid items-center gap-8 overflow-hidden rounded-lg border p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div className="flex flex-col gap-5">
        <h2
          id="cronometragem-titulo"
          className="text-ink text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          Cronometragem Grid Lap
        </h2>
        <p className="text-ink-2 max-w-prose text-base leading-relaxed">
          Acompanhe cada volta, da largada à bandeira. O Grid Lap registra a
          passagem de cada kart, monta a classificação sozinho e mostra a
          diferença para o líder e para quem vem logo à frente. Tudo numa tela
          só, no kartódromo, no celular ou na TV.
        </p>
        <ul className="flex flex-col gap-2.5">
          {RECURSOS.map((r) => (
            <li key={r} className="text-ink flex items-start gap-3 text-sm">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="text-orange mt-0.5 size-5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 10.5l4 4 8-9" />
              </svg>
              {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-bg border-border rounded-lg border p-2 sm:p-3">
        <Image
          src="/painel-cronometragem.webp"
          alt="Painel de cronometragem do Grid Lap com a classificação ao vivo, diferenças para o líder, melhor volta e grade de passagens, em dados de demonstração"
          width={1160}
          height={690}
          sizes="(min-width: 1024px) 560px, 100vw"
          className="h-auto w-full rounded-md"
        />
      </div>
    </section>
  );
}
