import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>;
}

export function Alert({ tone, children }: { tone: "error" | "ok" | "neutral"; children: ReactNode }) {
  return <div className={`alert alert--${tone}`}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="empty-state">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {action}
    </Panel>
  );
}

export function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="quota-bar">
      <div className="quota-bar__row">
        <span>{label}</span>
        <span className="nums">
          {used}/{limit}
        </span>
      </div>
      <div className="quota-bar__track" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
        <div className="quota-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="btn btn--primary" href={href}>
      {children}
    </Link>
  );
}
