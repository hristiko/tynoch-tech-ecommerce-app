export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square rounded-lg bg-sand/60" />
          <div className="mt-3 h-4 w-3/4 rounded bg-sand/60" />
          <div className="mt-2 h-4 w-1/3 rounded bg-sand/60" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/3 rounded bg-sand/60" />
      <div className="h-4 w-1/2 rounded bg-sand/60" />
      <div className="h-64 rounded-lg bg-sand/60" />
    </div>
  );
}
