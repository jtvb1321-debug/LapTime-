import { clsx } from "clsx";

export function Logo({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <span className="ring-border grid h-6 w-6 grid-cols-2 grid-rows-2 overflow-hidden rounded-[6px] bg-white ring-1">
        <span className="bg-orange" />
        <span />
        <span />
        <span className="bg-orange" />
      </span>
      <span className="inline-flex items-baseline font-black tracking-tight italic">
        <span
          className={clsx(
            "skew-x-[-8deg]",
            variant === "dark" ? "text-white" : "text-ink",
          )}
        >
          GRID
        </span>
        <span className="text-orange ml-1 skew-x-[-8deg]">LAP</span>
      </span>
    </span>
  );
}
