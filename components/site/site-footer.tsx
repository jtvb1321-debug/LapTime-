import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="bg-graphite text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-8">
        <Image
          src="/logo-gridlap-claro.svg"
          alt="Grid Lap"
          width={1000}
          height={334}
          unoptimized
          className="h-auto w-full max-w-[200px]"
        />
      </div>
    </footer>
  );
}
