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
        <span
          aria-hidden="true"
          className="bg-orange mb-2 block h-1 w-9 rounded-full"
        />
        <h1 className="font-display text-ink text-3xl leading-tight font-bold tracking-tight">
          {title}
        </h1>
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
