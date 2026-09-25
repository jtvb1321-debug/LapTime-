import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { VideoTracadoConfig } from "./tipos";
import { CENAS } from "./timeline";
import {
  segmentarTracado,
  segmentosParaPontosDensos,
} from "@/lib/tracado-vetorial";

interface PontoTracado2D {
  x: number;
  y: number;
}

// vFogDepth = distância até a câmera (espaço de visão) — um ShaderMaterial
// não ganha o fog da cena de graça como os materiais prontos do Three
// ganham; sem calcular isso à mão aqui, a linha nunca desaparece ao longe,
// e dá pra enxergar o lado oposto do traçado inteiro por trás — quebra
// completamente a sensação de estar "dentro" da pista no voo em primeira
// pessoa.
const VERTEX_TUBO = /* glsl */ `
varying vec2 vUv;
varying float vFogDepth;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_TUBO = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uOpacity;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uBrilhoBase;
varying vec2 vUv;
varying float vFogDepth;
void main() {
  if (vUv.x > uProgress) discard;
  float dist = uProgress - vUv.x;
  float cabeca = smoothstep(0.05, 0.0, dist);
  vec3 cor = uColor * uBrilhoBase * (1.0 + cabeca * 0.8);
  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
  cor = mix(cor, uFogColor, fogFactor);
  gl_FragColor = vec4(cor, uOpacity * (1.0 - fogFactor));
}
`;

// Blending normal (não aditivo) — um traçado aditivo só "acende" contra um
// fundo escuro; contra o fundo claro/branco atual, aditivo simplesmente
// satura pra branco e a linha some. Com blending normal a cor da linha
// aparece tal como é, funcionando em qualquer fundo.
function criarMaterialTubo(cor: string, opacidade: number, corFundo: string) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(cor) },
      uProgress: { value: 0 },
      uOpacity: { value: opacidade },
      uFogColor: { value: new THREE.Color(corFundo) },
      uFogDensity: { value: 0 },
      uBrilhoBase: { value: 1 },
    },
    vertexShader: VERTEX_TUBO,
    fragmentShader: FRAGMENT_TUBO,
    transparent: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

// Traçado completo, bem apagado, sempre visível por baixo da fita animada
// — dá pra ver o desenho inteiro do traçado o tempo todo, enquanto o
// "percurso" (a fita brilhante de cima, que segue o progresso do voo)
// mostra só o trecho já percorrido. Sem névoa de propósito (`fog: false`):
// é só uma referência de fundo, não deve sumir com a distância.
function criarMaterialTuboFundo(cor: string) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(cor),
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
}

// Faixa plana (não um tubo redondo) seguindo a curva, deitada no chão —
// um tubo com seção circular "torce" nas curvas (a normal do TubeGeometry
// gira pra acompanhar a curvatura), o que faz até uma pista lisa parecer
// uma dobra de intestino. Como a pista é sempre plana (todo ponto tem
// y=0), a normal "pra cima" nunca muda de verdade, então em vez de tubo
// construímos uma fita reta: em cada amostra da curva, projeta a
// perpendicular no plano XZ (cross do "pra cima" com a tangente) e marca
// um vértice de cada lado — sem ambiguidade de orientação, então nunca
// torce.
function criarFitaGeometria(
  curva: THREE.Curve<THREE.Vector3>,
  segmentos: number,
  largura: number,
): THREE.BufferGeometry {
  const cima = new THREE.Vector3(0, 1, 0);
  const metade = largura / 2;
  const posicoes: number[] = [];
  const normais: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segmentos; i++) {
    const t = (i % segmentos) / segmentos;
    const ponto = curva.getPointAt(t);
    const tangente = curva.getTangentAt(t).normalize();
    const perpendicular = new THREE.Vector3()
      .crossVectors(cima, tangente)
      .normalize();

    posicoes.push(
      ponto.x + perpendicular.x * metade,
      ponto.y + perpendicular.y * metade,
      ponto.z + perpendicular.z * metade,
      ponto.x - perpendicular.x * metade,
      ponto.y - perpendicular.y * metade,
      ponto.z - perpendicular.z * metade,
    );
    normais.push(0, 1, 0, 0, 1, 0);
    const progresso = i / segmentos;
    uvs.push(progresso, 0, progresso, 1);
  }

  for (let i = 0; i < segmentos; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posicoes, 3),
  );
  geometria.setAttribute("normal", new THREE.Float32BufferAttribute(normais, 3));
  geometria.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometria.setIndex(indices);
  return geometria;
}

// Fundo liso (cor sólida) com a logo da Grid Lap centralizada, discreta —
// como é uma textura 2D fixa no scene.background (não gira com a câmera),
// a logo fica sempre no mesmo lugar da tela, sem parecer "colada". Carrega
// a imagem de forma assíncrona (não trava a criação da cena) e só desenha
// quando ela terminar de carregar, marcando a textura pra atualizar no
// próximo frame.
function criarFundoComLogo(corBase: string): THREE.CanvasTexture {
  const tamanho = 512;
  const canvas = document.createElement("canvas");
  canvas.width = tamanho;
  canvas.height = tamanho;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = corBase;
  ctx.fillRect(0, 0, tamanho, tamanho);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;

  const logo = new Image();
  logo.onload = () => {
    const larguraLogo = tamanho * 0.6;
    const alturaLogo = larguraLogo * (logo.height / logo.width);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.drawImage(
      logo,
      (tamanho - larguraLogo) / 2,
      (tamanho - alturaLogo) / 2,
      larguraLogo,
      alturaLogo,
    );
    ctx.restore();
    textura.needsUpdate = true;
  };
  logo.src = "/logo-gridlap.png";

  return textura;
}

// Cena 3D "só a linha iluminada": o traçado vetorizado extrudado como uma
// fita fina e brilhante (o glow vem do bloom, não de uma segunda malha
// larga), sobre fundo liso, com uma câmera cinematográfica controlada por
// uma timeline do GSAP pausada — o
// preview ao vivo e a exportação frame a frame chamam o mesmo
// `definirTempo(t)`, garantindo que os dois produzam exatamente a mesma
// imagem pra cada instante.
export class CenaTracado3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private alvoCamera = new THREE.Vector3(0, 0, 0);
  private raioCena: number;
  private curva!: THREE.CatmullRomCurve3;
  private anguloAereoInicial = 0;
  private materialTuboPrincipal: THREE.ShaderMaterial;
  private centroConversao = { cx: 0, cy: 0, escala: 1 };
  private larguraAtual: number;
  private alturaAtual: number;
  private marcadoresCurvas: {
    nome: string;
    progresso: number;
    posicao3D: THREE.Vector3;
  }[] = [];
  private marcadorLargada: {
    progresso: number;
    posicao3D: THREE.Vector3;
    tangente3D: THREE.Vector3;
  } | null = null;
  usarBloom = true;

  constructor(
    config: VideoTracadoConfig,
    largura: number,
    altura: number,
    usarBloom = true,
  ) {
    this.usarBloom = usarBloom;
    this.larguraAtual = largura;
    this.alturaAtual = altura;
    this.canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(largura, altura, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = criarFundoComLogo(config.background);
    this.scene.fog = new THREE.FogExp2(config.background, 0.0022);

    this.camera = new THREE.PerspectiveCamera(45, largura / altura, 0.1, 2000);

    // --- Geometria da pista (mesmo traçado vetorizado do SVG 2D — retas
    // de verdade + cantos de raio único —, amostrado em pontos densos e
    // convertido pra um plano 3D XZ) ---
    const pontosVetorizadosBase = segmentosParaPontosDensos(
      segmentarTracado(config.trackPoints, true),
    );

    // Insere a linha de chegada como um ponto de verdade na malha densa
    // (não só um marcador visual por cima) — uma reta só gera os 2 pontos
    // das pontas, então a chegada podia cair bem longe do vértice mais
    // próximo já existente. Inserindo o ponto exato aqui, ao girar a lista
    // pra começar nele mais abaixo, o "passeio" (voo) nasce exatamente na
    // largada, sem aproximação.
    let pontosVetorizados = pontosVetorizadosBase;
    let indiceChegada: number | null = null;
    if (config.finishPoint) {
      let indiceMaisProximo = 0;
      let menorDistancia = Infinity;
      for (let i = 0; i < pontosVetorizadosBase.length; i++) {
        const p = pontosVetorizadosBase[i];
        const distancia = Math.hypot(
          p.x - config.finishPoint.x,
          p.y - config.finishPoint.y,
        );
        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          indiceMaisProximo = i;
        }
      }
      indiceChegada = indiceMaisProximo + 1;
      pontosVetorizados = [
        ...pontosVetorizadosBase.slice(0, indiceChegada),
        { x: config.finishPoint.x, y: config.finishPoint.y },
        ...pontosVetorizadosBase.slice(indiceChegada),
      ];
    }

    const pontos3d = this.converterPontos(pontosVetorizados);
    const bbox = new THREE.Box3().setFromPoints(pontos3d);
    const tamanho = new THREE.Vector3();
    bbox.getSize(tamanho);
    // Raio da cena = metade da DIAGONAL da caixa (não só do maior lado) —
    // um traçado alongado ou irregular tem cantos mais longe do centro do
    // que a metade do seu lado maior sozinho, e usar só isso deixava a
    // câmera perto demais pra caber a pista inteira (cortando pontas).
    this.raioCena = Math.max(Math.hypot(tamanho.x, tamanho.z) / 2, 1) || 20;

    // Gira a lista pra começar (índice 0, ou seja, u=0 na curva) exatamente
    // na largada.
    const pontosOrdenados =
      indiceChegada !== null
        ? [...pontos3d.slice(indiceChegada), ...pontos3d.slice(0, indiceChegada)]
        : pontos3d;

    const curva = new THREE.CatmullRomCurve3(pontosOrdenados, true, "centripetal");
    this.curva = curva;
    const larguraPista = Math.max(this.raioCena * 0.06, 1.2);
    const segmentosPista = Math.max(200, config.trackPoints.length * 12);
    // Ângulo de onde a órbita aérea começa, depois do voo — continua
    // aproximadamente a direção em que o voo estava indo, em vez de saltar
    // pra um ângulo arbitrário quando a câmera troca de modo.
    const tangenteFinal = curva.getTangentAt(1).normalize();
    this.anguloAereoInicial = Math.atan2(tangenteFinal.z, tangenteFinal.x);

    // --- Modo "só a linha", sem halo largo por geometria (isso que fazia
    // parecer um órgão/tubo gordo) e sem depender de bloom pra aparecer —
    // uma fita sólida, mais grossa que a primeira tentativa fina, na cor
    // primária.
    this.materialTuboPrincipal = criarMaterialTubo(
      config.primaryColor,
      1,
      config.background,
    );
    const geometriaPrincipal = criarFitaGeometria(
      curva,
      segmentosPista,
      larguraPista * 0.22,
    );

    // Traçado completo apagado por baixo (mesma geometria, outro material)
    // — sempre visível, pra dar contexto de onde o percurso em destaque
    // está dentro do desenho inteiro.
    const meshFundo = new THREE.Mesh(
      geometriaPrincipal,
      criarMaterialTuboFundo(config.primaryColor),
    );
    meshFundo.position.y = 0.1;
    this.scene.add(meshFundo);

    const meshPrincipal = new THREE.Mesh(
      geometriaPrincipal,
      this.materialTuboPrincipal,
    );
    meshPrincipal.position.y = 0.12;
    this.scene.add(meshPrincipal);

    // --- Nomes das curvas + marcador da largada (não são objetos 3D, só
    // posições — quem desenha é `desenharExtras`, projetando na tela) ---
    this.marcadoresCurvas = (config.curvas ?? []).map((c) => {
      const posicao3D = this.converterPonto(c.ponto);
      return {
        nome: c.nome,
        progresso: this.progressoNaCurva(curva, posicao3D),
        posicao3D,
      };
    });
    if (config.finishPoint) {
      const posicao3D = this.converterPonto(config.finishPoint);
      const progresso = this.progressoNaCurva(curva, posicao3D);
      const tangente3D = curva.getTangentAt(progresso).normalize();
      this.marcadorLargada = { progresso, posicao3D, tangente3D };
    }

    // --- Pós-processamento (bloom) ---
    // Bloom parte de "o que já está claro estoura mais ainda" — num fundo
    // escuro isso cria o brilho da linha; num fundo claro/branco a cena
    // inteira já está perto do branco, então o bloom estoura tudo pra
    // branco junto e a linha simplesmente some. Só liga o bloom se o fundo
    // for escuro o suficiente pra fazer sentido, mesmo com o efeito
    // marcado.
    const corFundoBloom = new THREE.Color(config.background);
    const luminanciaFundo =
      0.2126 * corFundoBloom.r + 0.7152 * corFundoBloom.g + 0.0722 * corFundoBloom.b;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.usarBloom && luminanciaFundo < 0.5) {
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(largura, altura),
        0.85,
        0.55,
        0.15,
      );
      this.composer.addPass(bloom);
    }
    this.composer.addPass(new OutputPass());

    this.definirTempo(0);
  }

  private converterPontos(pontos: PontoTracado2D[]): THREE.Vector3[] {
    const cx = pontos.reduce((s, p) => s + p.x, 0) / pontos.length;
    const cy = pontos.reduce((s, p) => s + p.y, 0) / pontos.length;
    const xs = pontos.map((p) => p.x);
    const ys = pontos.map((p) => p.y);
    const span = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      1,
    );
    const escala = 42 / span;
    this.centroConversao = { cx, cy, escala };
    return pontos.map(
      (p) => new THREE.Vector3((p.x - cx) * escala, 0, (p.y - cy) * escala),
    );
  }

  // Converte um ponto avulso (fora da lista de pontos do traçado, tipo a
  // largada ou o marcador de uma curva) com a mesma transformação usada
  // pros pontos do percurso — recalcular centro/escala a partir de um
  // único ponto colapsaria tudo em (0,0,0).
  private converterPonto(ponto: PontoTracado2D): THREE.Vector3 {
    const { cx, cy, escala } = this.centroConversao;
    return new THREE.Vector3(
      (ponto.x - cx) * escala,
      0,
      (ponto.y - cy) * escala,
    );
  }

  // Acha o ponto da curva 3D mais próximo de um alvo (por amostragem) e
  // devolve o parâmetro u (0..1) dele — usado pra saber "em que altura do
  // desenho da linha" fica uma curva nomeada ou a largada.
  private progressoNaCurva(
    curva: THREE.Curve<THREE.Vector3>,
    alvo: THREE.Vector3,
  ): number {
    const amostras = 400;
    let melhorU = 0;
    let melhorDist = Infinity;
    for (let i = 0; i <= amostras; i++) {
      const u = i / amostras;
      const dist = curva.getPointAt(u).distanceToSquared(alvo);
      if (dist < melhorDist) {
        melhorDist = dist;
        melhorU = u;
      }
    }
    return melhorU;
  }

  // Projeta um ponto 3D pra coordenadas de tela (pixels) na resolução
  // atual — usado pelo overlay 2D (mesmo canvas do nome/recorde) pra
  // desenhar o nome da curva e o marcador de largada na posição certa,
  // mesmo com a câmera se movendo.
  private projetarParaTela(pos: THREE.Vector3): {
    x: number;
    y: number;
    naFrente: boolean;
  } {
    const ndc = pos.clone().project(this.camera);
    return {
      x: ((ndc.x + 1) / 2) * this.larguraAtual,
      y: ((1 - ndc.y) / 2) * this.alturaAtual,
      naFrente: ndc.z < 1,
    };
  }

  // Câmera "voando" por dentro do traçado, seguindo exatamente o ponto que
  // a linha luminosa está desenhando naquele instante (mesmo `u` do
  // shader) — baixa, olhando pra ELA MESMA (a ponta acesa), como um drone
  // acompanhando a linha sendo traçada. Importante: a câmera fica um
  // pouco ATRÁS do ponto atual e mira NELE, nunca além — o trecho além do
  // ponto atual ainda não foi desenhado (o shader descarta), então mirar
  // à frente da cabeça da linha mostraria só vazio/preto.
  private calcularCameraVoo(t: number): {
    posicao: THREE.Vector3;
    alvo: THREE.Vector3;
  } {
    const u = progressoDesenho(t);
    const ponto = this.curva.getPointAt(u);
    const tangente = this.curva.getTangentAt(u).normalize();
    // Bem baixa (quase na altura da própria linha) — é isso que dá a
    // sensação de estar DENTRO da pista, e não sobrevoando ela de um
    // drone lá de cima. Com a câmera tão rente ao chão, o mesmo
    // deslocamento no traçado parece bem mais rápido (efeito de
    // paralaxe), então o avanço em si precisa ser bem mais lento pra
    // compensar — ver DURACAO do `tracadoLuminoso` em timeline.ts.
    const alturaVoo = this.raioCena * 0.025;
    const recuo = this.raioCena * 0.11;

    const posicao = ponto
      .clone()
      .addScaledVector(tangente, -recuo)
      .add(new THREE.Vector3(0, alturaVoo, 0));
    const alvo = ponto.clone().add(new THREE.Vector3(0, alturaVoo * 0.4, 0));
    return { posicao, alvo };
  }

  // Visão aérea ampla — mesma função pra intro (traçado já aceso, no
  // início) e pra saída (depois do voo): um enquadramento aberto que gira
  // devagar em torno do centro, nunca uma imagem morta parada.
  private calcularCameraAerea(
    anguloBase: number,
    girarPara: number,
    deriva: number,
  ): { posicao: THREE.Vector3; alvo: THREE.Vector3 } {
    // girarPara=1 é o enquadramento final (depois do voo) — só um pouco
    // mais aberto que o inicial, não o dobro: bem mais que isso e o
    // traçado inteiro encolhe demais dentro do quadro e fica ilegível.
    const raioReal = THREE.MathUtils.lerp(
      this.raioCena * 1.4,
      this.raioCena * 1.7,
      girarPara,
    );
    const alturaReal = THREE.MathUtils.lerp(
      this.raioCena * 1.3,
      this.raioCena * 1.55,
      girarPara,
    );
    const anguloRad =
      this.anguloAereoInicial +
      anguloBase +
      THREE.MathUtils.lerp(0, Math.PI * 0.5, girarPara) +
      deriva;

    const posicao = new THREE.Vector3(
      Math.cos(anguloRad) * raioReal,
      alturaReal,
      Math.sin(anguloRad) * raioReal,
    );
    return { posicao, alvo: this.alvoCamera.clone() };
  }

  // Chamado pelo preview (a cada rAF) e pela exportação (a cada frame) —
  // atualiza câmera + progresso do desenho da linha pro instante `t`.
  // Quatro fases, em moldura: vista aérea inicial (traçado já pronto) →
  // mergulho (desce e apaga) → voo por dentro (desenha de novo, cada curva
  // com seu nome) → vista aérea final (sobe de volta, sem os nomes).
  definirTempo(t: number) {
    const [inicioMergulho, fimMergulho] = CENAS.mergulho;
    const [inicioVoo, fimVoo] = CENAS.tracadoLuminoso;
    // Mais longa que antes — a volta do voo pra vista aérea era um corte
    // rápido demais; esticando o blend, a câmera sobe devagar em vez de dar
    // um salto perceptível de posição.
    const duracaoTransicaoSaida = 3;

    let posicao: THREE.Vector3;
    let alvo: THREE.Vector3;
    // 0 = névoa/enquadramento de vista aérea, 1 = de dentro do voo — usado
    // tanto pra saber que câmera mostrar quanto pra névoa acompanhar junto.
    let alphaParaVoo: number;

    if (t < inicioMergulho) {
      const intro = this.calcularCameraAerea(-Math.PI * 0.5, 0, 0);
      posicao = intro.posicao;
      alvo = intro.alvo;
      alphaParaVoo = 0;
    } else if (t < fimMergulho) {
      const origem = this.calcularCameraAerea(-Math.PI * 0.5, 0, 0);
      const destino = this.calcularCameraVoo(inicioVoo);
      alphaParaVoo = suavizarBorda(inicioMergulho, fimMergulho, t);
      posicao = origem.posicao.clone().lerp(destino.posicao, alphaParaVoo);
      alvo = origem.alvo.clone().lerp(destino.alvo, alphaParaVoo);
    } else if (t <= fimVoo) {
      const voo = this.calcularCameraVoo(t);
      posicao = voo.posicao;
      alvo = voo.alvo;
      alphaParaVoo = 1;
    } else {
      const voo = this.calcularCameraVoo(fimVoo);
      const derivaContinua =
        Math.max(0, t - (fimVoo + 5)) * 0.035;
      const aerea = this.calcularCameraAerea(
        0,
        suavizarBorda(fimVoo, fimVoo + 5, t),
        derivaContinua,
      );
      alphaParaVoo = 1 - suavizarBorda(fimVoo, fimVoo + duracaoTransicaoSaida, t);
      posicao = voo.posicao.clone().lerp(aerea.posicao, 1 - alphaParaVoo);
      alvo = voo.alvo.clone().lerp(aerea.alvo, 1 - alphaParaVoo);
    }

    this.camera.position.copy(posicao);
    this.camera.lookAt(alvo);

    // Névoa densa durante o voo (esconde o lado oposto do traçado, senão
    // dava pra ver através dele todo e a sensação de "estar dentro" se
    // perdia) — dilui até quase sumir nas visões aéreas, que precisam
    // mostrar o traçado inteiro sem nada escondendo as pontas. As duas
    // densidades são relativas ao raio da cena, pra funcionar igual em
    // traçados de qualquer tamanho.
    const densidadeVoo = 2.5 / this.raioCena;
    const densidadeAerea = 0.15 / this.raioCena;
    this.materialTuboPrincipal.uniforms.uFogDensity.value = THREE.MathUtils.lerp(
      densidadeAerea,
      densidadeVoo,
      alphaParaVoo,
    );

    // Na vista aérea o traçado inteiro já está completo, então quase toda a
    // linha fica longe da "cabeça" que ganha brilho extra no voo — sem
    // compensar, ela aparece fraca/fina lá de cima. Um brilho base mais
    // alto (só fora do voo) deixa o traçado com mais evidência nas duas
    // vistas aéreas, sem mudar nada durante o voo em si.
    const brilhoAereo = 1.3;
    this.materialTuboPrincipal.uniforms.uBrilhoBase.value = THREE.MathUtils.lerp(
      brilhoAereo,
      1,
      alphaParaVoo,
    );

    const progresso = progressoDesenho(t);
    this.materialTuboPrincipal.uniforms.uProgress.value = progresso;
  }

  renderizar() {
    this.composer.render();
  }

  redimensionar(largura: number, altura: number) {
    this.larguraAtual = largura;
    this.alturaAtual = altura;
    this.renderer.setSize(largura, altura, false);
    this.camera.aspect = largura / altura;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(largura, altura);
  }

  // Desenha, num canvas 2D por cima do WebGL (o mesmo padrão do overlay de
  // nome/recorde), o nome de cada curva enquanto a linha passa por ela
  // durante a revelação, e o marcador de largada + seta de sentido quando
  // o desenho termina. Chamado tanto pelo preview ao vivo quanto pela
  // exportação frame a frame, sempre com o mesmo `t` passado pra
  // `definirTempo`.
  desenharExtras(
    ctx: CanvasRenderingContext2D,
    t: number,
    largura: number,
    altura: number,
  ) {
    const escala = largura / 1920;
    const progresso = progressoDesenho(t);
    // Margem de segurança: a câmera enquadra o traçado inteiro, mas em
    // certos instantes um canto específico pode projetar bem perto da
    // borda (ou levemente fora) do quadro — trava a posição do rótulo
    // dentro de uma margem interna pra ele nunca ficar cortado/invisível.
    const margem = 28 * escala;
    // Nome de curva só durante o voo de verdade (enquanto o traçado está
    // sendo desenhado pela primeira vez) — nem antes (vista aérea inicial,
    // ainda sem traçado) nem depois (vista aérea final, já completo), só
    // sobrando o marcador de largada nessas duas.
    const mostrarNomesDeCurva =
      t >= CENAS.tracadoLuminoso[0] && t <= CENAS.tracadoLuminoso[1];

    for (const marcador of mostrarNomesDeCurva ? this.marcadoresCurvas : []) {
      const proj = this.projetarParaTela(marcador.posicao3D);
      if (!proj.naFrente) continue;
      const opacidade = opacidadeDaCurva(progresso, marcador.progresso);
      if (opacidade < 0.02) continue;
      const x = Math.min(Math.max(proj.x, margem), largura - margem);
      const y = Math.min(Math.max(proj.y, margem), altura - margem);
      const texto = marcador.nome.toUpperCase();

      ctx.save();
      ctx.globalAlpha = opacidade;
      ctx.font = `800 ${21 * escala}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Placa por baixo do texto (não só sombra) — garante leitura mesmo
      // em cima da própria linha clara ou de um fundo claro.
      const yTexto = y - 24 * escala;
      const largTexto = ctx.measureText(texto).width;
      const padH = 14 * escala;
      const padV = 7 * escala;
      ctx.fillStyle = "rgba(10,10,16,0.72)";
      ctx.beginPath();
      const raioPlaca = 8 * escala;
      const px = x - largTexto / 2 - padH;
      const py = yTexto - padV - 10 * escala;
      const pw = largTexto + padH * 2;
      const ph = padV * 2 + 20 * escala;
      ctx.moveTo(px + raioPlaca, py);
      ctx.arcTo(px + pw, py, px + pw, py + ph, raioPlaca);
      ctx.arcTo(px + pw, py + ph, px, py + ph, raioPlaca);
      ctx.arcTo(px, py + ph, px, py, raioPlaca);
      ctx.arcTo(px, py, px + pw, py, raioPlaca);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(texto, x, yTexto);
      ctx.restore();
    }

    if (this.marcadorLargada) {
      const opacidadeLargada = suavizarBorda(0.97, 1, progresso);
      const proj = this.projetarParaTela(this.marcadorLargada.posicao3D);
      if (proj.naFrente && opacidadeLargada > 0.02) {
        const pontoTangente = this.marcadorLargada.posicao3D
          .clone()
          .addScaledVector(
            this.marcadorLargada.tangente3D,
            this.raioCena * 0.08,
          );
        const projTangente = this.projetarParaTela(pontoTangente);
        const anguloRad = Math.atan2(
          projTangente.y - proj.y,
          projTangente.x - proj.x,
        );
        const x = Math.min(Math.max(proj.x, margem), largura - margem);
        const y = Math.min(Math.max(proj.y, margem), altura - margem);
        desenharMarcadorLargada(ctx, x, y, anguloRad, escala, opacidadeLargada);
      }
    }
  }

  descartar() {
    this.renderer.dispose();
    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.geometry.dispose();
        const materiais = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const mat of materiais) {
          if ("map" in mat && mat.map instanceof THREE.Texture) {
            mat.map.dispose();
          }
          mat.dispose();
        }
      }
    });
  }
}

// Progresso 0..1 do desenho do traçado — nada desenhado antes/durante a
// vista aérea inicial e o mergulho (só aparece de verdade durante o voo por
// dentro), ficando completo apenas no fim (voo + vista aérea final).
function progressoDesenho(t: number) {
  const [inicio, fim] = CENAS.tracadoLuminoso;
  if (t <= inicio) return 0;
  if (t >= fim) return 1;
  const linear = (t - inicio) / (fim - inicio);
  return linear * linear * (3 - 2 * linear);
}

function suavizarBorda(inicio: number, fim: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - inicio) / (fim - inicio)));
  return t * t * (3 - 2 * t);
}

// Opacidade do nome de uma curva: entra pouco antes da linha luminosa
// chegar nela, fica visível durante a passagem e some logo depois — só
// aparece uma vez, no momento em que aquele trecho está sendo desenhado.
function opacidadeDaCurva(progressoAtual: number, uCurva: number): number {
  const distancia = progressoAtual - uCurva;
  const entrada = -0.14; // começa a aparecer bem antes da linha chegar
  const segura = -0.02; // já totalmente visível um pouco antes
  const seguraFim = 0.08; // ...e continua assim por um trecho
  const saida = 0.5; // só então desaparece, bem devagar
  if (distancia < entrada || distancia > saida) return 0;
  if (distancia < segura) return suavizarBorda(entrada, segura, distancia);
  if (distancia < seguraFim) return 1;
  return 1 - suavizarBorda(seguraFim, saida, distancia);
}

// Ícone da largada em canvas 2D (halo branco + quadriculado + seta de
// sentido) — mesmo espírito visual de components/tracado-marcador-largada.tsx,
// só que projetado a partir de uma posição 3D em vez de fixo no SVG.
function desenharMarcadorLargada(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  anguloRad: number,
  escala: number,
  opacidade: number,
) {
  ctx.save();
  ctx.globalAlpha = opacidade;

  const raioHalo = 20 * escala;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.arc(x, y, raioHalo, 0, Math.PI * 2);
  ctx.fill();

  const celula = 5 * escala;
  const colunas = 3;
  const ladoQuadriculado = colunas * celula;
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    x - ladoQuadriculado / 2,
    y - ladoQuadriculado / 2,
    ladoQuadriculado,
    ladoQuadriculado,
  );
  ctx.clip();
  for (let linha = 0; linha < colunas; linha++) {
    for (let coluna = 0; coluna < colunas; coluna++) {
      ctx.fillStyle = (linha + coluna) % 2 === 0 ? "#171a23" : "#ffffff";
      ctx.fillRect(
        x - ladoQuadriculado / 2 + coluna * celula,
        y - ladoQuadriculado / 2 + linha * celula,
        celula,
        celula,
      );
    }
  }
  ctx.restore();
  ctx.strokeStyle = "#171a23";
  ctx.lineWidth = 1 * escala;
  ctx.strokeRect(
    x - ladoQuadriculado / 2,
    y - ladoQuadriculado / 2,
    ladoQuadriculado,
    ladoQuadriculado,
  );

  const distanciaSeta = raioHalo + 10 * escala;
  const tamanhoSeta = 7 * escala;
  ctx.save();
  ctx.translate(
    x + Math.cos(anguloRad) * distanciaSeta,
    y + Math.sin(anguloRad) * distanciaSeta,
  );
  ctx.rotate(anguloRad);
  ctx.fillStyle = "#8b5cf6";
  ctx.strokeStyle = "#5b21b6";
  ctx.lineWidth = 1 * escala;
  ctx.beginPath();
  ctx.moveTo(tamanhoSeta, 0);
  ctx.lineTo(-tamanhoSeta * 0.55, tamanhoSeta * 0.6);
  ctx.lineTo(-tamanhoSeta * 0.2, 0);
  ctx.lineTo(-tamanhoSeta * 0.55, -tamanhoSeta * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}
