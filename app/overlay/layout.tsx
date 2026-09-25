import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overlay",
  robots: { index: false, follow: false },
};

// Páginas de overlay são carregadas como Browser Source no OBS — precisam de
// fundo transparente, o que o layout raiz (app/layout.tsx) não oferece porque
// o resto do site usa um <body> com cor sólida. Esse <style> global sobrepõe
// só enquanto uma rota /overlay/* estiver montada.
export default function OverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        html, body { background: transparent !important; }
        @keyframes overlay-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes overlay-popup-in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {children}
    </>
  );
}
