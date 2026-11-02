import { ProductGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-sand/60" />
      <ProductGridSkeleton />
    </div>
  );
}
