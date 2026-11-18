import { Card, CardBody } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-ink-3 text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="font-display text-ink mt-1 text-3xl leading-tight font-bold">
          {value}
        </p>
        {hint ? <p className="text-ink-2 mt-1 text-xs">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}
