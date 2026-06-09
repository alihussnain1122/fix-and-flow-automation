'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Shield, Trash2, LogIn } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/FormFields';

export function AccountsClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [scheduleLimits, setScheduleLimits] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [accounts, schedules] = await Promise.all([api.accounts.list(), api.schedules.list()]);
      setItems(accounts.items);
      const limits = new Map<string, number>();
      for (const schedule of schedules.items) {
        limits.set(String(schedule.accountId), Number(schedule.dailyPostLimit));
      }
      setScheduleLimits(limits);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.accounts.create({
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
      });
      setModalOpen(false);
      setForm({ email: '', password: '', displayName: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (id: string) => {
    setConnectingId(id);
    setConnectMessage('');
    setError('');
    try {
      setConnectMessage(
        'Browser opening — credentials filled automatically. Captchas are solved via 2captcha (see logs/captcha.log). Complete 2FA in the browser if Facebook asks.',
      );
      const result = await api.accounts.login(id);
      const success = Boolean(result.success);
      setConnectMessage(
        success
          ? 'Facebook connected. Session saved — automation can use this account.'
          : String(result.reason || 'Login did not complete'),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Facebook login failed');
      setConnectMessage('');
    } finally {
      setConnectingId(null);
    }
  };

  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'displayName', label: 'Name', render: (r: Record<string, unknown>) => String(r.displayName || '—') },
    {
      key: 'status',
      label: 'Status',
      render: (r: Record<string, unknown>) => <Badge status={String(r.status)} />,
    },
    {
      key: 'postsToday',
      label: 'Posts Today',
      render: (r: Record<string, unknown>) => {
        const limit = scheduleLimits.get(String(r.id));
        return limit != null ? `${r.postsToday}/${limit}` : `${r.postsToday} (no schedule)`;
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (r: Record<string, unknown>) => formatDate(String(r.createdAt)),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: Record<string, unknown>) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={connectingId === String(r.id)}
            onClick={() => handleConnect(String(r.id))}
          >
            <LogIn className="w-3 h-3" />
            {connectingId === String(r.id) ? 'Connecting…' : 'Connect Facebook'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!!connectingId}
            onClick={async () => {
              await api.accounts.verify(String(r.id));
              load();
            }}
          >
            <Shield className="w-3 h-3" /> Verify
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (confirm('Delete this account?')) {
                await api.accounts.delete(String(r.id));
                load();
              }
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {connectMessage && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-200">
          {connectMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>
      )}
      <p className="mb-4 text-sm text-gray-600">
        Daily post limits are configured per account on the Schedules page — not here.
      </p>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>
      <DataTable columns={columns} data={items} loading={loading} emptyMessage="No accounts yet. Add your first Facebook account." />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Facebook Account"
        footer={
          <ModalActions onCancel={() => setModalOpen(false)} onSubmit={handleCreate} loading={saving} submitLabel="Create" />
        }
      >
        <div className="space-y-4">
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Input label="Display Name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
