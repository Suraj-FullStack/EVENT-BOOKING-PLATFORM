import { Button } from "./ui";

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-slate-600">
        Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of{" "}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          ← Previous
        </Button>
        <span className="px-2 text-sm text-slate-600">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next →
        </Button>
      </div>
    </nav>
  );
}
