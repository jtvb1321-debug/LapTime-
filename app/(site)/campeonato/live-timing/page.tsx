import type { Metadata } from "next";
import { LiveTimingCampeonato } from "@/components/campeonato/live-timing-campeonato";

export const metadata: Metadata = { title: "Live timing" };
export const dynamic = "force-dynamic";

export default function LiveTimingPage() {
  return <LiveTimingCampeonato />;
}
