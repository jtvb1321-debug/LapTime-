import { AdminNavInferior } from "@/components/admin/admin-nav-inferior";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { CanvasEscuro } from "@/components/ui/canvas-escuro";
import type { SessionUser } from "@/lib/auth";

// Moldura do painel: barra superior, conteúdo e a navegação inferior (poucos acessos fixos e "Mais"
// com todos os módulos). O conteúdo ganha espaço no fim (--nav-inferior) para a barra nunca cobrir
// botões, formulários nem tabelas.
export function AdminShell({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <CanvasEscuro className="gl-admin flex flex-col">
      <a
        href="#conteudo"
        className="bg-orange text-on-orange fixed top-2 left-2 z-[70] -translate-y-16 rounded-md px-3 py-2 text-sm font-medium focus:translate-y-0 print:hidden"
      >
        Pular para o conteúdo
      </a>
      <div className="print:hidden">
        <AdminTopbar session={session} />
      </div>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1600px] flex-1 overflow-x-hidden p-4 pb-[calc(var(--nav-inferior)+1.5rem)] outline-none sm:p-6 sm:pb-[calc(var(--nav-inferior)+2rem)] print:overflow-visible print:p-0"
      >
        {children}
      </main>
      <AdminNavInferior papel={session.papel} />
    </CanvasEscuro>
  );
}
