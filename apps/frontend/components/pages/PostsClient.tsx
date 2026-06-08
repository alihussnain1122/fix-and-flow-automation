'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Play, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/FormFields';

import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace-categories';
import { MARKETPLACE_CONDITIONS } from '@/lib/marketplace-conditions';

const CUSTOM_CATEGORY_VALUE = '__custom__';

type PostForm = {
  accountId: string;
  title: string;
  description: string;
  price: string;
  categoryPreset: string;
  customCategory: string;
  condition: string;
  city: string;
  imageUrls: string[];
};

const emptyForm: PostForm = {
  accountId: '',
  title: '',
  description: '',
  price: '',
  categoryPreset: MARKETPLACE_CATEGORIES[0],
  customCategory: '',
  condition: MARKETPLACE_CONDITIONS[0],
  city: '',
  imageUrls: [],
};

function resolveCategoryForSubmit(form: PostForm): string {
  if (form.categoryPreset === CUSTOM_CATEGORY_VALUE) {
    return form.customCategory.trim();
  }
  return form.categoryPreset;
}

function categoryToFormFields(category: string): Pick<PostForm, 'categoryPreset' | 'customCategory'> {
  const preset = MARKETPLACE_CATEGORIES.find(
    (item) => item.toLowerCase() === category.toLowerCase(),
  );
  if (preset) {
    return { categoryPreset: preset, customCategory: '' };
  }
  return { categoryPreset: CUSTOM_CATEGORY_VALUE, customCategory: category };
}

function conditionToFormField(condition: string): string {
  const match = MARKETPLACE_CONDITIONS.find(
    (item) => item.toLowerCase() === condition.toLowerCase(),
  );
  return match ?? MARKETPLACE_CONDITIONS[0];
}

function canExecutePost(status: string) {
  return status !== 'published' && status !== 'in_progress' && status !== 'queued';
}

export function PostsClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [form, setForm] = useState<PostForm>(emptyForm);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [cityError, setCityError] = useState('');
  const [cityVerified, setCityVerified] = useState('');
  const [cityChecking, setCityChecking] = useState(false);

  const validateCityInput = useCallback(async (city: string) => {
    const trimmed = city.trim();
    if (!trimmed) {
      setCityError('City is required for Marketplace posting');
      setCityVerified('');
      return false;
    }

    setCityChecking(true);
    setCityError('');
    try {
      const result = await api.cities.validate(trimmed);
      if (!result.valid) {
        setCityError(result.reason ?? 'City not found');
        setCityVerified('');
        return false;
      }
      const normalized = result.normalized ?? trimmed;
      setCityVerified(normalized);
      setForm((prev) => (prev.city === normalized ? prev : { ...prev, city: normalized }));
      return true;
    } catch (err) {
      setCityError(err instanceof Error ? err.message : 'Could not verify city');
      setCityVerified('');
      return false;
    } finally {
      setCityChecking(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [posts, accs, automation] = await Promise.all([
        api.posts.list(),
        api.accounts.list(),
        api.posts.getAutomationSettings(),
      ]);
      setItems(posts.items);
      setAccounts(accs.items);
      setAutomationEnabled(automation.enabled);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setImagePreviews([]);
    setCityError('');
    setCityVerified('');
    setModalOpen(true);
  };

  const openEdit = (post: Record<string, unknown>) => {
    const urls = Array.isArray(post.imageUrls) ? (post.imageUrls as string[]) : [];
    const metadata = (post.metadata ?? {}) as Record<string, unknown>;
    const city = String(metadata.city ?? '');
    const savedCategory = String(metadata.category ?? MARKETPLACE_CATEGORIES[0]);
    const savedCondition = String(metadata.condition ?? MARKETPLACE_CONDITIONS[0]);
    setEditId(String(post.id));
    setForm({
      accountId: String(post.accountId),
      title: String(post.title ?? ''),
      description: String(post.description ?? ''),
      price: post.price != null ? String(post.price) : '',
      condition: conditionToFormField(savedCondition),
      city,
      ...categoryToFormFields(savedCategory),
      imageUrls: urls,
    });
    setImagePreviews(urls);
    setCityError('');
    setCityVerified(city);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
    setImagePreviews([]);
    setCityError('');
    setCityVerified('');
  };

  const columns = [
    { key: 'title', label: 'Title', render: (r: Record<string, unknown>) => String(r.title).slice(0, 40) },
    { key: 'status', label: 'Status', render: (r: Record<string, unknown>) => <Badge status={String(r.status)} /> },
    { key: 'price', label: 'Price', render: (r: Record<string, unknown>) => r.price ? `$${r.price}` : '—' },
    {
      key: 'metadata',
      label: 'Listing',
      render: (r: Record<string, unknown>) => {
        const metadata = (r.metadata ?? {}) as Record<string, unknown>;
        const category = metadata.category ? String(metadata.category) : '—';
        const condition = metadata.condition ? String(metadata.condition) : '—';
        return (
          <span className="text-xs text-gray-600">
            {category} · {condition}
          </span>
        );
      },
    },
    { key: 'createdAt', label: 'Created', render: (r: Record<string, unknown>) => formatDate(String(r.createdAt)) },
    {
      key: 'actions',
      label: 'Actions',
      render: (r: Record<string, unknown>) => {
        const status = String(r.status);
        return (
          <div className="flex gap-2 flex-wrap">
            {canExecutePost(status) && (
              <Button size="sm" onClick={async () => {
                try {
                  await api.posts.execute(String(r.id));
                  load();
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Execute failed');
                }
              }}>
                <Play className="w-3 h-3" /> Execute
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
            <Button size="sm" variant="danger" onClick={async () => {
              if (!confirm('Delete this post?')) return;
              try {
                await api.posts.delete(String(r.id));
                load();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Delete failed');
              }
            }}>
              <Trash2 className="w-3 h-3" /> Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Automatic posting</h3>
            <p className="mt-1 text-sm text-gray-600">
              Add posts below, then enable automation to publish pending posts on Facebook without clicking Execute.
              Connect each account under Accounts first. Manual Execute still works anytime.
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <span className="text-sm font-medium text-gray-700">
              {automationEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300"
              checked={automationEnabled}
              disabled={automationSaving}
              onChange={async (e) => {
                setAutomationSaving(true);
                try {
                  const result = await api.posts.setAutomationSettings(e.target.checked);
                  setAutomationEnabled(result.enabled);
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Could not update automation setting');
                } finally {
                  setAutomationSaving(false);
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end mb-6">
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Post</Button>
      </div>
      <DataTable columns={columns} data={items} loading={loading} />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editId ? 'Edit Post' : 'Create Post'}
        footer={<ModalActions
          onCancel={closeModal}
          onSubmit={async () => {
            try {
              const cityOk = await validateCityInput(form.city);
              if (!cityOk) return;

              const category = resolveCategoryForSubmit(form);
              if (!category) {
                alert('Enter a custom category or pick one from the list');
                return;
              }

              if (!form.title.trim()) {
                alert('Title is required');
                return;
              }

              if (!form.price.trim()) {
                alert('Price is required');
                return;
              }

              if (editId) {
                await api.posts.update(editId, {
                  title: form.title,
                  description: form.description,
                  price: Number(form.price),
                  city: form.city,
                  category,
                  condition: form.condition,
                  imageUrls: form.imageUrls,
                });
              } else {
                await api.posts.create({
                  accountId: form.accountId,
                  title: form.title,
                  description: form.description || undefined,
                  price: Number(form.price),
                  city: form.city,
                  category,
                  condition: form.condition,
                  imageUrls: form.imageUrls.length ? form.imageUrls : undefined,
                });
              }
              closeModal();
              load();
            } catch (err) {
              alert(err instanceof Error ? err.message : 'Save failed');
            }
          }}
          submitLabel={editId ? 'Save' : 'Create'}
        />}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 rounded-md bg-gray-50 p-3 border">
            Facebook order: upload images → title → price → category → condition → Show more → city → Next → Publish.
          </p>

          {!editId && (
            <>
              <label className="block text-sm font-medium text-gray-700">Account</label>
              <select
                className="w-full px-3 py-2 border rounded-lg text-sm"
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              >
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>{String(a.email)}</option>
                ))}
              </select>
            </>
          )}

          <Input label="Title (required)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="Price (required)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />

          <label className="block text-sm font-medium text-gray-700">Category (required)</label>
          <select
            className="w-full px-3 py-2 border rounded-lg text-sm"
            value={form.categoryPreset}
            onChange={(e) => setForm({ ...form, categoryPreset: e.target.value })}
          >
            {MARKETPLACE_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
            <option value={CUSTOM_CATEGORY_VALUE}>Custom...</option>
          </select>
          {form.categoryPreset === CUSTOM_CATEGORY_VALUE && (
            <Input
              label="Custom category"
              placeholder="Enter exact Marketplace category name"
              value={form.customCategory}
              onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
            />
          )}

          <label className="block text-sm font-medium text-gray-700">Condition (required)</label>
          <select
            className="w-full px-3 py-2 border rounded-lg text-sm"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
          >
            {MARKETPLACE_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>{condition}</option>
            ))}
          </select>

          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div>
            <Input
              label="City (required — under Show more on Facebook)"
              placeholder="e.g. Houston, TX"
              value={form.city}
              onChange={(e) => {
                setForm({ ...form, city: e.target.value });
                setCityError('');
                setCityVerified('');
              }}
              onBlur={() => { if (form.city.trim()) validateCityInput(form.city); }}
            />
            {cityChecking && <p className="text-sm text-gray-500 mt-1">Verifying city...</p>}
            {cityVerified && !cityError && (
              <p className="text-sm text-green-600 mt-1">Verified: {cityVerified}</p>
            )}
            {cityError && <p className="text-sm text-red-600 mt-1">{cityError}</p>}
          </div>

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
                setForm((prev) => ({ ...prev, imageUrls: previews }));
              }}
            />

            {imagePreviews.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {imagePreviews.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-20 h-20 object-cover rounded-md border" />
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
