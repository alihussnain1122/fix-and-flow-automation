'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Phone } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/FormFields';

export function CitiesClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', state: '', country: 'US' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.cities.list()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'name', label: 'City' },
    { key: 'state', label: 'State', render: (r: Record<string, unknown>) => String(r.state || '—') },
    { key: 'country', label: 'Country' },
    { key: 'postCount', label: 'Posts' },
    { key: 'isActive', label: 'Active', render: (r: Record<string, unknown>) => r.isActive ? 'Yes' : 'No' },
    {
      key: 'actions', label: '',
      render: (r: Record<string, unknown>) => (
        <Button size="sm" variant="danger" onClick={async () => { await api.cities.delete(String(r.id)); load(); }}>
          <Trash2 className="w-3 h-3" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Add City</Button>
      </div>
      <DataTable columns={columns} data={items} loading={loading} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add City"
        footer={<ModalActions onCancel={() => setModalOpen(false)} onSubmit={async () => {
          await api.cities.create(form); setModalOpen(false); load();
        }} />}>
        <div className="space-y-4">
          <Input label="City Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}

export function LeadsClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.leads.list()).items); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'contactName', label: 'Contact', render: (r: Record<string, unknown>) => String(r.contactName || '—') },
    { key: 'phone', label: 'Phone', render: (r: Record<string, unknown>) => String(r.phone || '—') },
    { key: 'email', label: 'Email', render: (r: Record<string, unknown>) => String(r.email || '—') },
    { key: 'status', label: 'Status', render: (r: Record<string, unknown>) => <Badge status={String(r.status)} /> },
    {
      key: 'actions', label: 'Actions',
      render: (r: Record<string, unknown>) => r.status !== 'converted' ? (
        <Button size="sm" onClick={async () => { await api.leads.convert(String(r.id)); load(); }}>
          <Phone className="w-3 h-3" /> Convert
        </Button>
      ) : null,
    },
  ];

  return <DataTable columns={columns} data={items} loading={loading} emptyMessage="No leads yet. Leads are auto-created from inbox messages with phone/email." />;
}
