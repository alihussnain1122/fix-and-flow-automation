'use client';

interface TableProps {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  data: Record<string, unknown>[];
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable({ columns, data, loading, emptyMessage = 'No data found' }: TableProps) {
  if (loading) {
    return (
      <div className="card p-12 text-center text-sm text-gray-500">Loading...</div>
    );
  }

  if (!data.length) {
    return (
      <div className="card p-12 text-center text-sm text-gray-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr key={String(row.id ?? i)} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 text-gray-700">
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
