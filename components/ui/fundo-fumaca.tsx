"use client";

import { useEffect, useRef } from "react";

const VERTEX = `
  attribute vec4 a_position;
  void main() { gl_Position = a_position; }
`;

// Fumaça luminosa: ondas distorcidas que reagem ao ponteiro. Só cor e movimento, sem dados.
const FRAGMENT = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  float time = iTime * 0.5;
  vec2 mouse = iMouse / iResolution;
  vec2 rippleCenter = 2.0 * mouse - 1.0;
  vec2 distortion = centeredUV;
  for (float i = 1.0; i < 8.0; i++) {
    distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
    distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
  }
  float wave = abs(sin(distortion.x + distortion.y + time));
  float glow = smoothstep(0.9, 0.2, wave);
  gl_FragColor = vec4(u_color * glow, 1.0);
}
`;

function hexParaRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

// Fundo WebGL da tela de login. Renderiza em meia resolução (é só um brilho), pausa com a aba
// oculta, fica parado com movimento reduzido e, sem WebGL, o fundo escuro da página aparece.
export function FundoFumaca({
  cor = "#1d4ed8",
  className = "",
}: {
  cor?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const compilar = (tipo: number, fonte: string) => {
      const s = gl.createShader(tipo);
      if (!s) return null;
      gl.shaderSource(s, fonte);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = compilar(gl.VERTEX_SHADER, VERTEX);
    const fs = compilar(gl.FRAGMENT_SHADER, FRAGMENT);
    const programa = gl.createProgram();
    if (!vs || !fs || !programa) return;
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) return;
    gl.useProgram(programa);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const pos = gl.getAttribLocation(programa, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(programa, "iResolution");
    const uTempo = gl.getUniformLocation(programa, "iTime");
    const uMouse = gl.getUniformLocation(programa, "iMouse");
    const [r, g, b] = hexParaRgb(cor);
    gl.uniform3f(gl.getUniformLocation(programa, "u_color"), r, g, b);

    const escala = 0.5;
    const mouse = { x: 0.5, y: 0.5 };
    const aoMover = (e: PointerEvent) => {
      mouse.x = e.clientX / window.innerWidth;
      mouse.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", aoMover);

    const inicio = performance.now();
    let quadro = 0;
    const desenhar = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * escala));
      const h = Math.max(1, Math.round(canvas.clientHeight * escala));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTempo, (performance.now() - inicio) / 1000);
      gl.uniform2f(uMouse, mouse.x * w, mouse.y * h);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const laco = () => {
      desenhar();
      quadro = requestAnimationFrame(laco);
    };
    const parado = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (parado) desenhar();
    else laco();

    const visibilidade = () => {
      cancelAnimationFrame(quadro);
      if (!document.hidden && !parado) laco();
    };
    document.addEventListener("visibilitychange", visibilidade);

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("pointermove", aoMover);
      document.removeEventListener("visibilitychange", visibilidade);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [cor]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
