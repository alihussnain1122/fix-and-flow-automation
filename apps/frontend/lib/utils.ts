import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-700',
    banned: 'bg-red-100 text-red-800',
    flagged: 'bg-orange-100 text-orange-800',
    pending: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    in_progress: 'bg-blue-100 text-blue-800',
    unread: 'bg-blue-100 text-blue-800',
    replied: 'bg-green-100 text-green-800',
    new: 'bg-purple-100 text-purple-800',
    converted: 'bg-green-100 text-green-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}
