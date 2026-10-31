export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-ink text-xl font-semibold">{title}</h1>
        {description ? (
          <p className="text-ink-2 mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
