interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton loading placeholder that matches content shape.
 * Use className to set dimensions and aspect ratio.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-zinc-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

interface SkeletonRowProps {
  columns?: number;
}

/**
 * Skeleton row for table loading states.
 */
export function SkeletonRow({ columns = 5 }: SkeletonRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === 0 ? 'w-32' : i === 1 ? 'w-24' : 'w-16'}`}
        />
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

/**
 * Skeleton table for loading states.
 */
export function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-3 ${i === 0 ? 'w-24' : i === 1 ? 'w-20' : 'w-14'}`}
          />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
  );
}
