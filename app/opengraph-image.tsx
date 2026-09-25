import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#12141b",
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
              background: i % 2 === 0 ? "rgba(255,255,255,0.8)" : "transparent",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 90,
            height: 90,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", width: "100%", height: "50%" }}>
            <div
              style={{
                display: "flex",
                width: "50%",
                height: "100%",
                background: "#7c3aed",
              }}
            />
            <div
              style={{
                display: "flex",
                width: "50%",
                height: "100%",
                background: "#ffffff",
              }}
            />
          </div>
          <div style={{ display: "flex", width: "100%", height: "50%" }}>
            <div
              style={{
                display: "flex",
                width: "50%",
                height: "100%",
                background: "#ffffff",
              }}
            />
            <div
              style={{
                display: "flex",
                width: "50%",
                height: "100%",
                background: "#7c3aed",
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 900,
            fontStyle: "italic",
          }}
        >
          <span style={{ color: "#ffffff" }}>GRID</span>
          <span style={{ color: "#7c3aed", marginLeft: 24 }}>LAP</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 34,
          color: "rgba(255,255,255,0.5)",
        }}
      >
        Classificação, calendário, resultados e live timing
      </div>
    </div>,
    { ...size },
  );
}
