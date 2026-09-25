// Config "trocável sem reprogramar" pedida no briefing: tudo que muda entre
// um vídeo e outro (nome do traçado, categoria, cores, texto de largada...)
// fica neste objeto — a animação (câmera, desenho da linha, cenas) nunca
// referencia esses valores diretamente, só lê deste config.
export interface VideoTracadoConfig {
  trackName: string;
  category: string;
  battery: string;
  startText: string;
  trackLength: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  background: string;
  trackPoints: { x: number; y: number }[];
  finishPoint?: { x: number; y: number };
  direction?: "horario" | "anti_horario";
  // Pontos de referência pra dar nome às curvas — aparecem na tela enquanto
  // a linha luminosa desenha aquele trecho durante a revelação.
  curvas?: { ponto: { x: number; y: number }; nome: string }[];
}

export interface Resolucao {
  label: string;
  largura: number;
  altura: number;
}

export const RESOLUCOES: Resolucao[] = [
  { label: "Horizontal — 1920×1080", largura: 1920, altura: 1080 },
  { label: "Vertical — 1080×1920", largura: 1080, altura: 1920 },
];
