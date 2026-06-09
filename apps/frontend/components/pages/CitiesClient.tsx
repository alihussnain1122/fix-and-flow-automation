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
  const [cityError, setCityError] = useState('');
  const [cityVerified, setCityVerified] = useState('');
  const [cityChecking, setCityChecking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.cities.list()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const validateCityInput = useCallback(async (name: string, state: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setCityError('City name is required');
      setCityVerified('');
      return false;
    }

    const query = [trimmedName, state.trim()].filter(Boolean).join(', ');
    setCityChecking(true);
    setCityError('');
    try {
      const result = await api.cities.validate(query);
      if (!result.valid) {
        setCityError(result.reason ?? 'City not found');
        setCityVerified('');
        return false;
      }
      const normalized = result.normalized ?? query;
      setCityVerified(normalized);
      if (result.name) {
        setForm((prev) => ({
          ...prev,
          name: result.name ?? prev.name,
          state: result.state ?? prev.state,
        }));
      }
      return true;
    } catch (err) {
      setCityError(err instanceof Error ? err.message : 'Could not verify city');
      setCityVerified('');
      return false;
    } finally {
      setCityChecking(false);
    }
  }, []);

  const openCreate = () => {
    setForm({ name: '', state: '', country: 'US' });
    setCityError('');
    setCityVerified('');
    setModalOpen(true);
  };

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
      <p className="mb-4 text-sm text-gray-600">
        Add US cities here. Each city is verified online before saving. Playwright rotates through active cities when posting.
      </p>
      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add City</Button>
      </div>
      <DataTable columns={columns} data={items} loading={loading} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add City"
        footer={<ModalActions onCancel={() => setModalOpen(false)} onSubmit={async () => {
          const ok = await validateCityInput(form.name, form.state);
          if (!ok) return;
          try {
            await api.cities.create(form);
            setModalOpen(false);
            load();
          } catch (err) {
            setCityError(err instanceof Error ? err.message : 'Could not add city');
          }
        }} />}>
        <div className="space-y-4">
          <Input
            label="City Name"
            placeholder="e.g. Houston"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setCityError('');
              setCityVerified('');
            }}
            onBlur={() => { if (form.name.trim()) validateCityInput(form.name, form.state); }}
          />
          <Input
            label="State"
            placeholder="e.g. TX"
            value={form.state}
            onChange={(e) => {
              setForm({ ...form, state: e.target.value });
              setCityError('');
              setCityVerified('');
            }}
            onBlur={() => { if (form.name.trim()) validateCityInput(form.name, form.state); }}
          />
          <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          {cityChecking && <p className="text-sm text-gray-500">Verifying city online...</p>}
          {cityVerified && !cityError && (
            <p className="text-sm text-green-600">Verified: {cityVerified}</p>
          )}
          {cityError && <p className="text-sm text-red-600">{cityError}</p>}
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
