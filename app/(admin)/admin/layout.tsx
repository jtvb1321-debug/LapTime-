import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, podeAcessarAdmin } from "@/lib/auth";
import { caminhoPermitidoAoPiloto } from "@/lib/admin-nav";
import { EntradaGrid } from "@/components/entrada/entrada-grid";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/admin");
  if (!podeAcessarAdmin(session.papel)) {
    // Piloto: só consulta, e só nas telas liberadas (ver lib/admin-nav.ts).
    const caminho = (await headers()).get("x-pathname") ?? "";
    if (session.papel !== "piloto" || !caminhoPermitidoAoPiloto(caminho)) {
      redirect("/area-do-piloto");
    }
  }

  return (
    <>
      <EntradaGrid />
      <AdminShell session={session}>{children}</AdminShell>
    </>
  );
}
