import * as THREE from "three";

// Céu procedural (horizonte claro, nuvens suaves, sol alinhado à luz da cena).
// As seis faces de 256 px são geradas uma única vez e reutilizadas: durante a
// reprodução só o cubemap é desenhado.
export function criarCeu(
  renderer: THREE.WebGLRenderer,
  direcaoDoSol: THREE.Vector3,
) {
  const cena = new THREE.Scene();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sunDirection: { value: direcaoDoSol.clone().normalize() },
      zenith: { value: new THREE.Color("#428bd0") },
      horizon: { value: new THREE.Color("#d9e7ea") },
      ground: { value: new THREE.Color("#9aa69b") },
      cloudColor: { value: new THREE.Color("#faf9f4") },
    },
    vertexShader: /* glsl */ `
      varying vec3 skyDirection;
      void main() {
        skyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDirection, zenith, horizon, ground, cloudColor;
      varying vec3 skyDirection;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float clouds(vec2 p) {
        float sum = 0.0, weight = 0.5;
        for (int i = 0; i < 5; i++) {
          sum += noise(p) * weight;
          p = p * 2.03 + vec2(17.1, 9.2);
          weight *= 0.5;
        }
        return sum;
      }
      void main() {
        vec3 direction = normalize(skyDirection);
        float altitude = max(direction.y, 0.0);
        vec3 color = mix(horizon, zenith, pow(altitude, 0.45));
        float sun = max(dot(direction, sunDirection), 0.0);
        color += vec3(0.22, 0.17, 0.09) * pow(sun, 24.0);

        vec2 p = direction.xz / max(direction.y + 0.12, 0.12) * 2.2;
        float density = clouds(p + vec2(4.3, 8.1));
        float coverage = smoothstep(0.49, 0.73, density);
        coverage *= smoothstep(0.02, 0.18, direction.y);
        vec3 litCloud = cloudColor * mix(0.78, 1.0, smoothstep(0.5, 0.8, density));
        color = mix(color, litCloud, coverage * 0.9);
        color += vec3(1.0, 0.88, 0.64) * smoothstep(0.9998, 0.99997, sun) * (1.0 - coverage);
        color = mix(color, ground, smoothstep(0.0, 0.18, -direction.y));
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
  cena.add(caixa);
  const alvo = new THREE.WebGLCubeRenderTarget(256, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    depthBuffer: false,
  });
  const camera = new THREE.CubeCamera(0.1, 10, alvo);
  try {
    camera.update(renderer, cena);
  } catch (erro) {
    alvo.dispose();
    throw erro;
  } finally {
    caixa.geometry.dispose();
    material.dispose();
  }
  return alvo;
}
