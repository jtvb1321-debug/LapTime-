import { Card, CardBody } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-ink-3 text-xs tracking-wide uppercase">{label}</p>
        <p className="text-ink mt-1 font-mono text-2xl font-semibold">
          {value}
        </p>
        {hint ? <p className="text-ink-2 mt-1 text-xs">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}
