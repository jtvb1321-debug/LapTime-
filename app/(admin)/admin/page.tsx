import { redirect } from "next/navigation";

// A entrada do admin é o passo a passo do balcão; o dashboard fica em /admin/dashboard.
export default function AdminInicioPage() {
  redirect("/admin/balcao");
}
