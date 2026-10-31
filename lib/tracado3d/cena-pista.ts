import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { acharMalhasDeAsfalto } from "./asfalto";
import { poseDoPiloto } from "./camera-piloto";
import { criarCeu } from "./ceu";
import { suavizarRota } from "./curva";
import {
  MAX_PONTOS,
  comprimentoDaRota,
  segmentosDaRota,
  type PontoRota,
} from "./rota";

export const MODELO_URL = "/modelos/velokart.glb";

export type ModoCena = "criar" | "editar" | "navegar";

export interface EventosDaCena {
  onPronto?: (temAsfalto: boolean) => void;
  onErro?: (mensagem: string) => void;
  // Clique no asfalto em modo "criar".
  onAdicionar?: (ponto: PontoRota) => void;
  // Antes do primeiro movimento de um arrasto (para o editor guardar o undo).
  onIniciarArraste?: (indice: number) => void;
  onMover?: (indice: number, ponto: PontoRota) => void;
  onSelecionar?: (indice: number) => void;
  onProgresso?: (distancia: number, total: number) => void;
  onFim?: () => void;
  onAviso?: (mensagem: string) => void;
}

export interface ResumoDaRota {
  total: number;
  invalidos: number;
}

const COR_VALIDA = 0x00b879;
const COR_INVALIDA = 0xe84d42;
const COR_PONTO = 0x0dbb80;
const COR_SELECIONADO = 0xffc55d;

// Cena Three.js da pista: modelo GLB, céu, rota (verde no asfalto, vermelha
// fora dele), edição por clique/arrasto e câmera do piloto. Não conhece React.
export class CenaPista {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private cena = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  private cameraPiloto = new THREE.PerspectiveCamera(75, 1, 0.05, 2000);
  private controles: OrbitControls;
  private ceu: THREE.WebGLRenderTarget;
  private sobreposicao = new THREE.Group();
  private manipuladores: THREE.Mesh[] = [];
  private asfalto: THREE.Mesh[] = [];
  private raio = new THREE.Raycaster();
  private vertical = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private observador: ResizeObserver;
  private quadro = 0;
  private anterior = performance.now();
  private morto = false;

  private pontos: PontoRota[] = [];
  private fechado = false;
  private selecionado = -1;
  private modo: ModoCena = "navegar";
  private trajetoria: PontoRota[] = [];
  private total = 0;
  private invalidos = 0;
  private visaoPiloto = false;
  private reproduzindo = false;
  private velocidadeKmh = 30;
  private distancia = 0;
  private arrastando: number | null = null;
  private toque: { x: number; y: number } | null = null;

  constructor(
    private container: HTMLElement,
    private eventos: EventosDaCena = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#bcc8c5");
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    container.append(this.canvas);

    this.cena.add(new THREE.HemisphereLight(0xffffff, 0x6e7961, 2.3));
    const sol = new THREE.DirectionalLight(0xffffff, 2.5);
    sol.position.set(-80, 200, 60);
    this.cena.add(sol);
    this.ceu = criarCeu(this.renderer, sol.position);
    this.cena.background = this.ceu.texture;
    this.cena.add(this.sobreposicao);

    this.controles = new OrbitControls(this.camera, this.canvas);
    this.controles.enableDamping = true;
    this.controles.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controles.minDistance = 15;
    this.controles.maxDistance = 650;

    this.canvas.addEventListener("pointerdown", this.aoPressionar);
    this.canvas.addEventListener("pointermove", this.aoMover);
    this.canvas.addEventListener("pointerup", this.aoSoltar);
    this.canvas.addEventListener("pointercancel", this.aoCancelar);

    this.observador = new ResizeObserver(() => this.redimensionar());
    this.observador.observe(container);
    this.redimensionar();
    this.quadro = requestAnimationFrame(this.desenhar);
    this.carregar();
  }

  // ---- carregamento -------------------------------------------------------
  private carregar() {
    new GLTFLoader().load(
      MODELO_URL,
      (gltf) => {
        if (this.morto) return;
        this.cena.add(gltf.scene);
        this.asfalto = acharMalhasDeAsfalto(gltf.scene);
        this.cena.updateMatrixWorld(true);
        this.enquadrar("perspectiva");
        this.aplicarModo();
        this.reconstruir();
        this.eventos.onPronto?.(this.asfalto.length > 0);
      },
      undefined,
      (erro) => {
        console.error(erro);
        if (!this.morto) {
          this.eventos.onErro?.("Não foi possível carregar o modelo da pista.");
        }
      },
    );
  }

  // ---- API ----------------------------------------------------------------
  definirRota(
    pontos: PontoRota[],
    fechado: boolean,
    selecionado = -1,
  ): ResumoDaRota {
    const mudouTrajeto =
      fechado !== this.fechado ||
      pontos.length !== this.pontos.length ||
      pontos.some(
        (p, i) => p.x !== this.pontos[i]?.x || p.z !== this.pontos[i]?.z,
      );
    this.pontos = pontos;
    this.fechado = fechado;
    this.selecionado = selecionado;
    // Só volta ao início quando o percurso muda; trocar o ponto selecionado
    // não interrompe a reprodução.
    if (mudouTrajeto) this.distancia = 0;
    this.reconstruir();
    return { total: this.total, invalidos: this.invalidos };
  }

  definirModo(modo: ModoCena) {
    this.modo = modo;
    this.aplicarModo();
    this.reconstruir();
  }

  definirVelocidade(kmh: number) {
    this.velocidadeKmh = kmh;
  }

  definirVisaoPiloto(ligada: boolean) {
    this.visaoPiloto = ligada;
    this.controles.enabled = !ligada;
    this.sobreposicao.visible = !ligada;
    this.toque = null;
    this.arrastando = null;
    this.atualizarCursor();
    if (ligada) this.atualizarCameraPiloto();
  }

  definirReproduzindo(reproduzir: boolean) {
    if (reproduzir && (this.invalidos > 0 || this.total === 0)) return;
    if (reproduzir && !this.fechado && this.distancia >= this.total) {
      this.distancia = 0;
    }
    this.reproduzindo = reproduzir;
  }

  reiniciar() {
    this.reproduzindo = false;
    this.distancia = 0;
    this.eventos.onProgresso?.(0, this.total);
    if (this.visaoPiloto) this.atualizarCameraPiloto();
  }

  enquadrar(vista: "topo" | "perspectiva") {
    this.definirVisaoPiloto(false);
    this.controles.target.set(0, 0, 0);
    if (vista === "topo") this.camera.position.set(0, 420, 0.1);
    else this.camera.position.set(240, 300, 290);
    this.camera.lookAt(this.controles.target);
    this.controles.update();
  }

  get tocando() {
    return this.reproduzindo;
  }

  // ---- rota e validação ---------------------------------------------------
  private dentroDoAsfalto(p: PontoRota) {
    if (!this.asfalto.length) return false;
    this.vertical.set(
      new THREE.Vector3(p.x, 50, p.z),
      new THREE.Vector3(0, -1, 0),
    );
    return this.vertical.intersectObjects(this.asfalto, false).length > 0;
  }

  // Amostra o trecho a cada ~35 cm; não é colisão contínua.
  private trechoValido(a: PontoRota, b: PontoRota) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.35));
    for (let i = 0; i <= n; i++) {
      if (
        !this.dentroDoAsfalto({
          x: a.x + ((b.x - a.x) * i) / n,
          z: a.z + ((b.z - a.z) * i) / n,
        })
      ) {
        return false;
      }
    }
    return true;
  }

  private limparSobreposicao() {
    while (this.sobreposicao.children.length) {
      const objeto = this.sobreposicao.children[0] as THREE.Mesh;
      this.sobreposicao.remove(objeto);
      objeto.geometry?.dispose();
      const material = objeto.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    }
    this.manipuladores.length = 0;
  }

  private reconstruir() {
    this.limparSobreposicao();
    this.trajetoria = suavizarRota(this.pontos, this.fechado);
    const segmentos = segmentosDaRota(this.trajetoria, this.fechado);
    this.invalidos = 0;
    const validos: number[] = [];
    const invalidos: number[] = [];
    for (const [a, b] of segmentos) {
      const ok = this.asfalto.length > 0 && this.trechoValido(a, b);
      if (!ok) this.invalidos++;
      (ok ? validos : invalidos).push(a.x, 0.32, a.z, b.x, 0.32, b.z);
    }
    for (const [vertices, cor] of [
      [validos, COR_VALIDA],
      [invalidos, COR_INVALIDA],
    ] as const) {
      if (!vertices.length) continue;
      const geometria = new THREE.BufferGeometry();
      geometria.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      this.sobreposicao.add(
        new THREE.LineSegments(
          geometria,
          new THREE.LineBasicMaterial({ color: cor }),
        ),
      );
    }
    this.pontos.forEach((p, i) => {
      const bola = new THREE.Mesh(
        new THREE.SphereGeometry(i === this.selecionado ? 1.05 : 0.72, 12, 8),
        new THREE.MeshBasicMaterial({
          color: i === this.selecionado ? COR_SELECIONADO : COR_PONTO,
        }),
      );
      bola.position.set(p.x, 0.85, p.z);
      bola.userData.indice = i;
      this.sobreposicao.add(bola);
      this.manipuladores.push(bola);
    });
    this.total = comprimentoDaRota(this.trajetoria, this.fechado);
    this.distancia = Math.min(this.distancia, this.total);
    this.eventos.onProgresso?.(this.distancia, this.total);
    if (this.visaoPiloto) this.atualizarCameraPiloto();
  }

  get resumo(): ResumoDaRota {
    return { total: this.total, invalidos: this.invalidos };
  }

  // ---- câmera do piloto ---------------------------------------------------
  private atualizarCameraPiloto() {
    const pose = poseDoPiloto(
      this.trajetoria,
      this.fechado,
      this.distancia,
      this.total,
    );
    if (!pose) return;
    this.cameraPiloto.position.set(
      pose.posicao.x,
      pose.posicao.y,
      pose.posicao.z,
    );
    this.cameraPiloto.lookAt(pose.alvo.x, pose.alvo.y, pose.alvo.z);
  }

  // ---- entrada (mouse/toque) ----------------------------------------------
  private aplicarModo() {
    this.controles.enableRotate = this.modo === "navegar";
    this.atualizarCursor();
  }

  private atualizarCursor() {
    this.canvas.style.cursor =
      this.visaoPiloto || this.modo === "navegar"
        ? "default"
        : this.modo === "criar"
          ? "crosshair"
          : "grab";
  }

  private apontar(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raio.setFromCamera(this.ndc, this.camera);
  }

  private pontoNoAsfalto(e: PointerEvent): PontoRota | null {
    this.apontar(e);
    const ponto = this.asfalto.length
      ? this.raio.intersectObjects(this.asfalto, false)[0]?.point
      : null;
    return ponto ? { x: ponto.x, z: ponto.z } : null;
  }

  private editavel() {
    return !this.visaoPiloto && this.modo !== "navegar" && this.asfalto.length;
  }

  private aoPressionar = (e: PointerEvent) => {
    if (e.button !== 0 || !this.editavel()) return;
    this.toque = { x: e.clientX, y: e.clientY };
    if (this.modo !== "editar") return;
    this.apontar(e);
    const acerto = this.raio.intersectObjects(this.manipuladores, false)[0];
    if (!acerto) return;
    const indice = acerto.object.userData.indice as number;
    this.eventos.onIniciarArraste?.(indice);
    this.eventos.onSelecionar?.(indice);
    this.arrastando = indice;
    this.controles.enabled = false;
    this.reproduzindo = false;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private aoMover = (e: PointerEvent) => {
    if (this.arrastando === null) return;
    const p = this.pontoNoAsfalto(e);
    if (p) this.eventos.onMover?.(this.arrastando, p);
  };

  private aoSoltar = (e: PointerEvent) => {
    if (this.arrastando !== null) {
      this.arrastando = null;
      this.controles.enabled = true;
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
      this.toque = null;
      return;
    }
    const inicio = this.toque;
    this.toque = null;
    if (
      !inicio ||
      this.modo !== "criar" ||
      Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) >= 5
    ) {
      return;
    }
    const p = this.pontoNoAsfalto(e);
    if (!p)
      return this.eventos.onAviso?.("Clique sobre a superfície asfaltada.");
    if (this.pontos.length >= MAX_PONTOS) {
      return this.eventos.onAviso?.(`Limite de ${MAX_PONTOS} pontos atingido.`);
    }
    this.reproduzindo = false;
    this.eventos.onAdicionar?.(p);
  };

  private aoCancelar = () => {
    this.arrastando = null;
    this.toque = null;
    this.controles.enabled = !this.visaoPiloto;
  };

  // ---- laço de desenho ----------------------------------------------------
  private redimensionar() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cameraPiloto.aspect = w / h;
    this.cameraPiloto.updateProjectionMatrix();
  }

  private desenhar = (agora: number) => {
    if (this.morto) return;
    this.quadro = requestAnimationFrame(this.desenhar);
    const dt = Math.min((agora - this.anterior) / 1000, 0.1);
    this.anterior = agora;
    if (this.reproduzindo && this.total > 0) {
      this.distancia += (dt * this.velocidadeKmh) / 3.6;
      if (this.distancia >= this.total) {
        if (this.fechado) this.distancia %= this.total;
        else {
          this.distancia = this.total;
          this.reproduzindo = false;
          this.eventos.onFim?.();
        }
      }
      this.eventos.onProgresso?.(this.distancia, this.total);
      if (this.visaoPiloto) this.atualizarCameraPiloto();
    }
    if (!this.visaoPiloto) this.controles.update();
    this.renderer.render(
      this.cena,
      this.visaoPiloto ? this.cameraPiloto : this.camera,
    );
  };

  // ---- encerramento -------------------------------------------------------
  dispose() {
    this.morto = true;
    cancelAnimationFrame(this.quadro);
    this.observador.disconnect();
    this.canvas.removeEventListener("pointerdown", this.aoPressionar);
    this.canvas.removeEventListener("pointermove", this.aoMover);
    this.canvas.removeEventListener("pointerup", this.aoSoltar);
    this.canvas.removeEventListener("pointercancel", this.aoCancelar);
    this.controles.dispose();
    this.limparSobreposicao();
    this.cena.traverse((objeto) => {
      const malha = objeto as THREE.Mesh;
      if (!malha.isMesh) return;
      malha.geometry.dispose();
      const materiais = Array.isArray(malha.material)
        ? malha.material
        : [malha.material];
      for (const material of materiais) {
        for (const valor of Object.values(material)) {
          if ((valor as THREE.Texture | undefined)?.isTexture) {
            (valor as THREE.Texture).dispose();
          }
        }
        material.dispose();
      }
    });
    this.ceu.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
