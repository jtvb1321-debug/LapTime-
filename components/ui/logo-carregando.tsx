import Image from "next/image";

// Carregamento estilo F1: a logo do Grid Lap vai se completando da esquerda para a direita.
export function LogoCarregando() {
  return (
    <div className="gl-carga" aria-hidden="true">
      <Image
        src="/logo-gridlap-claro.svg"
        alt=""
        width={1000}
        height={334}
        unoptimized
        priority
        className="gl-carga__img gl-carga__fantasma"
      />
      <Image
        src="/logo-gridlap-claro.svg"
        alt=""
        width={1000}
        height={334}
        unoptimized
        priority
        className="gl-carga__img gl-carga__cheio"
      />
      <span className="gl-carga__luz" />
    </div>
  );
}
