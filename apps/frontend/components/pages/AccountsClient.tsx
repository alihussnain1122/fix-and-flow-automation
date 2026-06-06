'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Shield, Trash2, LogIn } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/FormFields';

export function AccountsClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [form, setForm] = useState({ email: '', password: '', displayName: '', dailyPostLimit: '5' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.accounts.list();
      setItems(res.items);
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
        dailyPostLimit: Number(form.dailyPostLimit),
      });
      setModalOpen(false);
      setForm({ email: '', password: '', displayName: '', dailyPostLimit: '5' });
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
      setConnectMessage('Opening browser — log in to Facebook and complete 2FA if prompted…');
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
      render: (r: Record<string, unknown>) => `${r.postsToday}/${r.dailyPostLimit}`,
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
          <Select
            label="Daily Post Limit"
            value={form.dailyPostLimit}
            onChange={(e) => setForm({ ...form, dailyPostLimit: e.target.value })}
            options={[
              { value: '3', label: '3 posts/day' },
              { value: '4', label: '4 posts/day' },
              { value: '5', label: '5 posts/day' },
            ]}
          />
        </div>
      </Modal>
    </>
  );
}
