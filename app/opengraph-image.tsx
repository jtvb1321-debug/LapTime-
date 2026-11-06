import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagem de pré-visualização do link (WhatsApp, redes). Usa a logo oficial em
// PNG (o gerador de imagem não aceita WebP).
export default async function OpengraphImage() {
  const logo = await readFile(
    path.join(process.cwd(), "public", "logo-gridlap.png"),
  );
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#15181e",
        padding: 80,
      }}
    >
      <div style={{ display: "flex", width: "100%", height: 10 }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flex: 1,
              height: "100%",
              background: i % 2 === 0 ? "#ff5500" : "transparent",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            background: "#ffffff",
            borderRadius: 28,
            padding: 20,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={600} height={200} alt="Grid Lap" />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          fontSize: 34,
          color: "rgba(255,255,255,0.7)",
        }}
      >
        Classificação, calendário, resultados e live timing
      </div>
    </div>,
    { ...size },
  );
}
