import Link from "next/link";

interface Props { title: string; message: string; actionHref?: string; actionLabel?: string }

export default function EmptyState({ title, message, actionHref, actionLabel }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-ink/25 px-6 py-16 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{message}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary mt-6">{actionLabel}</Link>
      )}
    </div>
  );
}
