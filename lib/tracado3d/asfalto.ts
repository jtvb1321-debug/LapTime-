import type { Material, Mesh, Object3D } from "three";

// As superfícies da pista são identificadas pelo material "asfalto" (qualquer
// nome de malha) e, por compatibilidade, pela malha "Pista_Asfalto".
export function acharMalhasDeAsfalto(modelo: Object3D): Mesh[] {
  const malhas: Mesh[] = [];
  modelo.traverse((objeto) => {
    const malha = objeto as Mesh;
    if (!malha.isMesh) return;
    const materiais: (Material | undefined)[] = Array.isArray(malha.material)
      ? malha.material
      : [malha.material];
    const ehAsfalto = materiais.some(
      (m) => m?.name.toLowerCase() === "asfalto",
    );
    if (ehAsfalto || malha.name === "Pista_Asfalto") malhas.push(malha);
  });
  return malhas;
}
