import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`border-2 border-foreground bg-background ${className}`}>{children}</section>;
}

export function CardHeader({
  label,
  meta,
  action,
}: {
  label: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b-2 border-foreground px-4 py-2">
      <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{label}</span>
      <span className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        {meta ? <span>{meta}</span> : null}
        {action}
      </span>
    </header>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-4 lg:p-5 ${className}`}>{children}</div>;
}
