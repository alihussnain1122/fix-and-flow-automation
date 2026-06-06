'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/FormFields';

export function InboxClient() {
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateModal, setTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', content: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [msgs, tmpls, accs] = await Promise.all([api.inbox.messages(), api.inbox.templates(), api.accounts.list()]);
      setMessages(msgs.items);
      setTemplates(tmpls);
      setAccounts(accs.items);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const msgColumns = [
    { key: 'senderName', label: 'From', render: (r: Record<string, unknown>) => String(r.senderName || 'Unknown') },
    { key: 'content', label: 'Message', render: (r: Record<string, unknown>) => String(r.content).slice(0, 80) },
    { key: 'status', label: 'Status', render: (r: Record<string, unknown>) => <Badge status={String(r.status)} /> },
    { key: 'receivedAt', label: 'Received', render: (r: Record<string, unknown>) => formatDate(String(r.receivedAt)) },
  ];

  return (
    <>
      <div className="flex justify-end gap-3 mb-6">
        <Button variant="secondary" onClick={() => setTemplateModal(true)}><Plus className="w-4 h-4" /> Add Reply Template</Button>
        <select className="px-3 py-2 border rounded-lg text-sm" onChange={async (e) => {
          if (e.target.value) { await api.inbox.check(e.target.value); load(); e.target.value = ''; }
        }}>
          <option value="">Check inbox for...</option>
          {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{String(a.email)}</option>)}
        </select>
        <Button variant="secondary" onClick={load}><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mb-3">Messages</h3>
      <DataTable columns={msgColumns} data={messages} loading={loading} emptyMessage="No messages. Run an inbox check on an account." />

      <h3 className="text-sm font-semibold text-gray-700 mt-8 mb-3">Auto-Reply Templates ({templates.length})</h3>
      <div className="card divide-y divide-gray-100">
        {templates.map((t) => (
          <div key={String(t.id)} className="px-6 py-4">
            <p className="font-medium text-gray-900">{String(t.name)}</p>
            <p className="text-sm text-gray-500 mt-1">{String(t.content)}</p>
          </div>
        ))}
        {!templates.length && <p className="px-6 py-8 text-sm text-gray-500 text-center">No reply templates configured.</p>}
      </div>

      <Modal open={templateModal} onClose={() => setTemplateModal(false)} title="Add Reply Template"
        footer={<ModalActions onCancel={() => setTemplateModal(false)} onSubmit={async () => {
          await api.inbox.createTemplate(templateForm);
          setTemplateModal(false); load();
        }} />}>
        <div className="space-y-4">
          <Input label="Template Name" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
          <Textarea label="Reply Content" value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
