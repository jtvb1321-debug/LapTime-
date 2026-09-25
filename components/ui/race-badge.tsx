export function PoleBadge() {
  return (
    <span className="bg-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
      Pole
    </span>
  );
}

export function VoltaRapidaBadge({
  provisoria = false,
}: {
  provisoria?: boolean;
}) {
  return (
    <span className="bg-orange inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
      Volta rápida{provisoria ? " (ao vivo)" : ""}
    </span>
  );
}
