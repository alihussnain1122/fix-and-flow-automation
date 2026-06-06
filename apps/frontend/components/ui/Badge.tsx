'use client';

import { cn, statusColor } from '@/lib/utils';

export function Badge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
        statusColor(status),
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
