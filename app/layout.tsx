import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Trocar pelo domínio real quando o site for publicado — sem isso o Next
  // não consegue montar URL absoluta pra imagem de Open Graph.
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Grid Lap",
    template: "%s · Grid Lap",
  },
  description:
    "Campeonato Grid Lap — classificação, calendário, resultados e live timing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className="bg-bg text-ink min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
