'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';

export function LogsClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.logs.list()).items); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  const columns = [
    { key: 'level', label: 'Level', render: (r: Record<string, unknown>) => <Badge status={String(r.level)} /> },
    { key: 'category', label: 'Category' },
    { key: 'message', label: 'Message', render: (r: Record<string, unknown>) => String(r.message).slice(0, 100) },
    { key: 'createdAt', label: 'Time', render: (r: Record<string, unknown>) => formatDate(String(r.createdAt)) },
  ];

  return <DataTable columns={columns} data={items} loading={loading} emptyMessage="No logs yet. Activity will appear once the system runs." />;
}
