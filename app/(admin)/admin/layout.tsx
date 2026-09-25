import { redirect } from "next/navigation";
import { getSession, podeAcessarAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/admin");
  if (!podeAcessarAdmin(session.papel)) redirect("/area-do-piloto");

  return <AdminShell session={session}>{children}</AdminShell>;
}
