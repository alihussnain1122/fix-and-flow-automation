'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Play } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/FormFields';

export function PostsClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ accountId: '', title: '', description: '', price: '' });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [posts, accs] = await Promise.all([api.posts.list(), api.accounts.list()]);
      setItems(posts.items);
      setAccounts(accs.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { key: 'title', label: 'Title', render: (r: Record<string, unknown>) => String(r.title).slice(0, 40) },
    { key: 'status', label: 'Status', render: (r: Record<string, unknown>) => <Badge status={String(r.status)} /> },
    { key: 'price', label: 'Price', render: (r: Record<string, unknown>) => r.price ? `$${r.price}` : '—' },
    { key: 'createdAt', label: 'Created', render: (r: Record<string, unknown>) => formatDate(String(r.createdAt)) },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: Record<string, unknown>) => (
        <div className="flex gap-2">
          {r.status !== 'published' && (
            <Button size="sm" onClick={async () => { await api.posts.execute(String(r.id)); load(); }}>
              <Play className="w-3 h-3" /> Execute
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Create Post</Button>
      </div>
      <DataTable columns={columns} data={items} loading={loading} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Post"
        footer={<ModalActions onCancel={() => setModalOpen(false)} onSubmit={async () => {
          await api.posts.create({ accountId: form.accountId, title: form.title || undefined, description: form.description || undefined, price: form.price ? Number(form.price) : undefined });
          setModalOpen(false); load();
        }} submitLabel="Create" />}>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Account</label>
          <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            <option value="">Select account...</option>
            {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.email)}</option>)}
          </select>
          <Input label="Title (optional — auto-rotate)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description (optional — auto-rotate)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Images (optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                const previews: string[] = [];
                for (const f of files) {
                  const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = reject;
                    reader.readAsDataURL(f);
                  });
                  previews.push(data);
                }
                setImagePreviews(previews);
                // attach to form via metadata property for submit
                setForm({ ...form, imageUrls: previews } as any);
              }}
            />

            {imagePreviews.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {imagePreviews.map((src, i) => (
                  <img key={i} src={src} className="w-20 h-20 object-cover rounded-md border" />
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
