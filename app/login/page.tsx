import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="border-border bg-surface w-full max-w-sm rounded-lg border p-6">
        <Link href="/" className="mx-auto block w-48">
          <Image
            src="/logo-gridlap.webp"
            alt="Grid Lap"
            width={2000}
            height={667}
            priority
          />
        </Link>
        <p className="text-ink-2 mt-4 mb-6 text-center text-sm">
          Entre para acessar a área do piloto ou o admin.
        </p>
        <LoginForm redirectTo={redirectTo ?? "/"} />
      </div>
    </div>
  );
}
