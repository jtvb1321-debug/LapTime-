import type { Metadata } from "next";

export const metadata: Metadata = { title: "Painel de TV" };

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-header min-h-screen text-white">{children}</div>;
}
