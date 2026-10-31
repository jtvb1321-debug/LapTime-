import { AbasCronometragem } from "@/components/cronometragem/abas";

// Todas as telas da cronometragem compartilham a mesma barra de abas:
// Ao vivo · Baterias · Equipamentos.
export default function CronometragemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <AbasCronometragem />
      {children}
    </div>
  );
}
