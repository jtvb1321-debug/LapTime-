import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CanvasEscuro } from "@/components/ui/canvas-escuro";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <CanvasEscuro className="flex flex-col">
      <SiteHeader session={session} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
      <SiteFooter />
    </CanvasEscuro>
  );
}
