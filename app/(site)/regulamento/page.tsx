import type { Metadata } from "next";

export const metadata: Metadata = { title: "Regulamento" };

const SECOES = [
  {
    titulo: "1. Categorias",
    corpo:
      "O campeonato é disputado nas categorias Feminina, Rookie, Intermediária, Master e Sênior, definidas por experiência prévia e idade mínima do piloto.",
  },
  {
    titulo: "2. Balizamento e pole position",
    corpo:
      "Cada etapa é dividida em bateria classificatória e bateria final. O grid de largada da bateria final é definido pela classificação da bateria classificatória: o 1º colocado larga na pole position. A pole position define apenas a posição de largada — não concede pontos adicionais no campeonato.",
  },
  {
    titulo: "3. Pontuação e volta mais rápida",
    corpo:
      "Pontos são atribuídos por posição de chegada na bateria final: 25 para o 1º colocado, 20 para o 2º, 16 para o 3º, 13 para o 4º, 11 para o 5º e 10 para o 6º, reduzindo 1 ponto por posição a partir do 7º colocado (mínimo de 1 ponto). O piloto que registrar a volta mais rápida da bateria final recebe 1 ponto extra no campeonato, desde que termine entre os 10 primeiros colocados — mesma regra adotada atualmente na Fórmula 1.",
  },
  {
    titulo: "4. Karts e sorteio",
    corpo:
      "Os karts são padronizados e sorteados antes de cada bateria. A pesagem dos pilotos é obrigatória e ocorre até 30 minutos antes do horário previsto de largada.",
  },
  {
    titulo: "5. Punições",
    corpo:
      "Infrações de pista podem resultar em advertência, acréscimo de tempo, perda de posições no grid ou desqualificação, a critério da fiscalização de prova.",
  },
  {
    titulo: "6. Recursos",
    corpo:
      "Pilotos podem protocolar recurso contra decisões de pontuação ou punição em até 24 horas após a divulgação do resultado oficial da etapa.",
  },
];

export default function RegulamentoPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-display text-ink before:bg-orange text-3xl font-bold tracking-tight before:mb-2 before:block before:h-1 before:w-9 before:rounded-full before:content-['']">
          Regulamento
        </h1>
        <p className="text-ink-2 mt-1 text-sm">
          Regras gerais do campeonato Grid Lap.
        </p>
      </div>
      {SECOES.map((secao) => (
        <section
          key={secao.titulo}
          className="border-border flex flex-col gap-2 border-t pt-6"
        >
          <h2 className="text-ink text-base font-semibold">{secao.titulo}</h2>
          <p className="text-ink-2 text-sm leading-relaxed">{secao.corpo}</p>
        </section>
      ))}
    </div>
  );
}
