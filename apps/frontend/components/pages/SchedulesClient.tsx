'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pause, Play, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/FormFields';

export function SchedulesClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    accountId: '',
    minIntervalMinutes: '60',
    maxIntervalMinutes: '240',
    dailyPostLimit: '5',
  });

  const accountEmails = new Map(accounts.map((a) => [String(a.id), String(a.email)]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedules, accs] = await Promise.all([api.schedules.list(), api.accounts.list()]);
      setItems(schedules.items);
      setAccounts(accs.items);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      key: 'accountId',
      label: 'Account',
      render: (r: Record<string, unknown>) => accountEmails.get(String(r.accountId)) ?? String(r.accountId).slice(0, 8) + '...',
    },
    { key: 'status', label: 'Status', render: (r: Record<string, unknown>) => <Badge status={String(r.status)} /> },
    {
      key: 'dailyPostLimit',
      label: 'Daily Limit',
      render: (r: Record<string, unknown>) => `${r.dailyPostLimit} posts/day`,
    },
    {
      key: 'interval',
      label: 'Interval',
      render: (r: Record<string, unknown>) =>
        `${r.minIntervalMinutes}–${r.maxIntervalMinutes} min`,
    },
    { key: 'nextRunAt', label: 'Next Run', render: (r: Record<string, unknown>) => r.nextRunAt ? formatDate(String(r.nextRunAt)) : '—' },
    {
      key: 'actions', label: 'Actions',
      render: (r: Record<string, unknown>) => (
        <div className="flex gap-2">
          {r.status === 'active' ? (
            <Button size="sm" variant="secondary" onClick={async () => { await api.schedules.pause(String(r.id)); load(); }}><Pause className="w-3 h-3" /></Button>
          ) : (
            <Button size="sm" onClick={async () => { await api.schedules.resume(String(r.id)); load(); }}><Play className="w-3 h-3" /></Button>
          )}
          <Button size="sm" variant="danger" onClick={async () => { await api.schedules.delete(String(r.id)); load(); }}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <p className="mb-4 text-sm text-gray-600">
        Set each account&apos;s daily post limit here (3–5 posts/day per Fix &amp; Flow spec).
        Automation and manual Execute both respect this cap.
      </p>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Create Schedule</Button>
      </div>
      <DataTable columns={columns} data={items} loading={loading} emptyMessage="No schedules yet. Create one for each account you want to automate." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Schedule"
        footer={<ModalActions onCancel={() => setModalOpen(false)} onSubmit={async () => {
          if (!form.accountId) {
            alert('Select an account');
            return;
          }
          await api.schedules.create({
            accountId: form.accountId,
            minIntervalMinutes: Number(form.minIntervalMinutes),
            maxIntervalMinutes: Number(form.maxIntervalMinutes),
            dailyPostLimit: Number(form.dailyPostLimit),
          });
          setModalOpen(false);
          load();
        }} />}>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Account</label>
          <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            <option value="">Select account...</option>
            {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.email)}</option>)}
          </select>
          <Select
            label="Daily Post Limit (per account)"
            value={form.dailyPostLimit}
            onChange={(e) => setForm({ ...form, dailyPostLimit: e.target.value })}
            options={[
              { value: '3', label: '3 posts/day' },
              { value: '4', label: '4 posts/day' },
              { value: '5', label: '5 posts/day' },
            ]}
          />
          <Input label="Min Interval (minutes)" type="number" value={form.minIntervalMinutes} onChange={(e) => setForm({ ...form, minIntervalMinutes: e.target.value })} />
          <Input label="Max Interval (minutes)" type="number" value={form.maxIntervalMinutes} onChange={(e) => setForm({ ...form, maxIntervalMinutes: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
