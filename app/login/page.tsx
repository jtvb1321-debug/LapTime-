import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { FundoFumaca } from "@/components/ui/fundo-fumaca";
import { contasDemoPermitidas } from "@/lib/auth-core";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#050a14] px-4">
      <FundoFumaca />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-lg">
        <Link href="/" className="mx-auto block w-48">
          <Image
            src="/logo-gridlap-claro.svg"
            alt="Grid Lap"
            width={1000}
            height={334}
            unoptimized
            priority
          />
        </Link>
        <p className="mt-4 mb-8 text-center text-sm text-[#cfdcf3]">
          Entre para acessar a área do piloto ou o admin.
        </p>
        <LoginForm
          redirectTo={redirectTo ?? "/"}
          mostrarContasDemo={contasDemoPermitidas()}
        />
      </div>
    </main>
  );
}
