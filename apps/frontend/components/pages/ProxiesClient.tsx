'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Activity, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/FormFields';

export function ProxiesClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ host: '', port: '8080', username: '', password: '', type: 'residential' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.proxies.list()).items); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'host', label: 'Host', render: (r: Record<string, unknown>) => `${r.host}:${r.port}` },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status', render: (r: Record<string, unknown>) => <Badge status={String(r.status)} /> },
    { key: 'country', label: 'Country', render: (r: Record<string, unknown>) => String(r.country || '—') },
    {
      key: 'actions', label: 'Actions',
      render: (r: Record<string, unknown>) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={async () => { await api.proxies.healthCheck(String(r.id)); load(); }}>
            <Activity className="w-3 h-3" /> Check
          </Button>
          <Button size="sm" variant="danger" onClick={async () => { if (confirm('Delete?')) { await api.proxies.delete(String(r.id)); load(); } }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add Proxy</Button>
      </div>
      <DataTable columns={columns} data={items} loading={loading} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Proxy"
        footer={<ModalActions onCancel={() => setModalOpen(false)} onSubmit={async () => {
          await api.proxies.create({ ...form, port: Number(form.port) });
          setModalOpen(false); load();
        }} />}>
        <div className="space-y-4">
          <Input label="Host" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          <Input label="Port" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[{ value: 'residential', label: 'Residential' }, { value: 'datacenter', label: 'Datacenter' }, { value: 'mobile', label: 'Mobile' }]} />
        </div>
      </Modal>
    </>
  );
}
