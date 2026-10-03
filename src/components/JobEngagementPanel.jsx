import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/apiClient';
import { formatDateTime, fromLocalDateTimeInput, toLocalDateInput, toLocalDateTimeInput } from '../lib/dateTime';
import { color, font, radius } from '../theme';

const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'phone', label: 'Phone' },
  { value: 'in_person', label: 'In person' },
  { value: 'other', label: 'Other' },
];

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.7px',
  textTransform: 'uppercase',
  color: color.textMuted,
};

const inputStyle = {
  border: `1px solid ${color.inputBorder}`,
  borderRadius: radius.input,
  background: color.inputBg,
  color: color.ink,
  font: `400 13px ${font.body}`,
  outlineColor: color.accent,
  padding: '9px 10px',
  textTransform: 'none',
  letterSpacing: 0,
  width: '100%',
};

const sectionTitle = {
  margin: '8px 0 0',
  font: `600 13px ${font.heading}`,
  color: color.ink,
};

function SmallButton({ children, onClick, primary = false, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: primary ? 'none' : `1px solid ${danger ? '#e7bbb7' : color.inputBorder}`,
        borderRadius: radius.smallButton,
        background: primary ? color.accent : '#fff',
        color: primary ? '#fff' : danger ? color.urgent : color.textBodyMid,
        cursor: 'pointer',
        font: `600 11px ${font.body}`,
        padding: '6px 10px',
      }}
    >
      {children}
    </button>
  );
}

const emptyContact = () => ({ name: '', title: '', email: '', profileUrl: '', notes: '' });
const emptyOutreach = contacts => ({
  contactId: contacts[0]?.id ?? '',
  occurredAt: toLocalDateTimeInput(new Date().toISOString()),
  channel: 'email',
  note: '',
  nextFollowUpAt: '',
});

export default function JobEngagementPanel({ jobId, onChanged }) {
  const [contacts, setContacts] = useState([]);
  const [outreach, setOutreach] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contactDraft, setContactDraft] = useState(null);
  const [outreachDraft, setOutreachDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [contactPayload, outreachPayload] = await Promise.all([
        api.listContacts(jobId),
        api.listOutreach(jobId),
      ]);
      setContacts(contactPayload.contacts);
      setOutreach(outreachPayload.outreach);
      onChanged?.();
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [jobId, onChanged]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  const runMutation = async action => {
    setSaving(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (mutationError) {
      setError(mutationError.message);
    } finally {
      setSaving(false);
    }
  };

  const saveContact = () => runMutation(async () => {
    const payload = {
      name: contactDraft.name.trim(),
      title: contactDraft.title.trim(),
      email: contactDraft.email.trim(),
      profileUrl: contactDraft.profileUrl.trim() || null,
      notes: contactDraft.notes,
    };
    if (contactDraft.id) {
      await api.updateContact(jobId, contactDraft.id, payload);
    } else {
      await api.createContact(jobId, payload);
    }
    setContactDraft(null);
  });

  const saveOutreach = () => runMutation(async () => {
    const payload = {
      contactId: outreachDraft.contactId || null,
      occurredAt: fromLocalDateTimeInput(outreachDraft.occurredAt),
      channel: outreachDraft.channel,
      note: outreachDraft.note,
      nextFollowUpAt: outreachDraft.nextFollowUpAt
        ? fromLocalDateTimeInput(`${outreachDraft.nextFollowUpAt}T09:00`)
        : null,
    };
    if (outreachDraft.id) {
      await api.updateOutreach(jobId, outreachDraft.id, payload);
    } else {
      await api.createOutreach(jobId, payload);
    }
    setOutreachDraft(null);
  });

  if (loading) {
    return <div style={{ color: color.textSecondary, fontSize: 12 }}>Loading contacts and outreach…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error ? <div style={{ padding: '8px 10px', borderRadius: radius.input, background: '#fff0ee', color: color.urgent, fontSize: 12 }}>{error}</div> : null}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={sectionTitle}>People</h3>
          {!contactDraft ? (
            <SmallButton primary onClick={() => setContactDraft(emptyContact())}>Add contact</SmallButton>
          ) : null}
        </div>
        {contactDraft ? (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: radius.input, border: `1px solid ${color.cardBorder}`, background: color.tideglass }}>
            <label style={labelStyle}>Name<input value={contactDraft.name} onChange={event => setContactDraft({ ...contactDraft, name: event.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Title<input value={contactDraft.title} onChange={event => setContactDraft({ ...contactDraft, title: event.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Email<input type="email" value={contactDraft.email} onChange={event => setContactDraft({ ...contactDraft, email: event.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>LinkedIn / URL<input type="url" value={contactDraft.profileUrl} onChange={event => setContactDraft({ ...contactDraft, profileUrl: event.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Notes<textarea rows={2} value={contactDraft.notes} onChange={event => setContactDraft({ ...contactDraft, notes: event.target.value })} style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <SmallButton onClick={() => setContactDraft(null)}>Cancel</SmallButton>
              <SmallButton primary onClick={saveContact} disabled={saving || !contactDraft.name.trim()}>Save contact</SmallButton>
            </div>
          </div>
        ) : null}
        {contacts.length === 0 && !contactDraft ? (
          <div style={{ marginTop: 8, color: color.textSecondary, fontSize: 12 }}>No contacts yet. Add recruiters, hiring managers, or referrals for this role.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contacts.map(contact => (
              <li key={contact.id} style={{ padding: 11, borderRadius: radius.input, border: `1px solid ${color.rowDivider}`, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: color.textBodyMid }}>{contact.name}</div>
                    {contact.title ? <div style={{ fontSize: 12, color: color.textSecondary }}>{contact.title}</div> : null}
                    {contact.email ? <div style={{ fontSize: 11.5, color: color.textMuted, marginTop: 4 }}>{contact.email}</div> : null}
                    {contact.profileUrl ? (
                      <a href={contact.profileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 4, fontSize: 11.5, color: color.accent, fontWeight: 600 }}>Profile ↗</a>
                    ) : null}
                    {contact.notes ? <div style={{ marginTop: 6, fontSize: 11.5, color: color.textSecondary, whiteSpace: 'pre-wrap' }}>{contact.notes}</div> : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SmallButton onClick={() => setContactDraft({ ...contact, profileUrl: contact.profileUrl ?? '' })}>Edit</SmallButton>
                    <SmallButton danger onClick={() => runMutation(() => api.deleteContact(jobId, contact.id))}>Delete</SmallButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={sectionTitle}>Outreach log</h3>
          {!outreachDraft ? (
            <SmallButton primary onClick={() => setOutreachDraft(emptyOutreach(contacts))}>Log outreach</SmallButton>
          ) : null}
        </div>
        {outreachDraft ? (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9, padding: 12, borderRadius: radius.input, border: `1px solid ${color.cardBorder}`, background: color.tideglass }}>
            <label style={labelStyle}>Contact
              <select value={outreachDraft.contactId} onChange={event => setOutreachDraft({ ...outreachDraft, contactId: event.target.value })} style={inputStyle}>
                <option value="">No specific contact</option>
                {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>When<input type="datetime-local" value={outreachDraft.occurredAt} onChange={event => setOutreachDraft({ ...outreachDraft, occurredAt: event.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Channel
              <select value={outreachDraft.channel} onChange={event => setOutreachDraft({ ...outreachDraft, channel: event.target.value })} style={inputStyle}>
                {CHANNELS.map(channel => <option key={channel.value} value={channel.value}>{channel.label}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Note<textarea rows={2} value={outreachDraft.note} onChange={event => setOutreachDraft({ ...outreachDraft, note: event.target.value })} style={{ ...inputStyle, resize: 'vertical' }} /></label>
            <label style={labelStyle}>Next follow-up<input type="date" value={outreachDraft.nextFollowUpAt} onChange={event => setOutreachDraft({ ...outreachDraft, nextFollowUpAt: event.target.value })} style={inputStyle} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <SmallButton onClick={() => setOutreachDraft(null)}>Cancel</SmallButton>
              <SmallButton primary onClick={saveOutreach} disabled={saving || !outreachDraft.occurredAt}>Save entry</SmallButton>
            </div>
          </div>
        ) : null}
        {outreach.length === 0 && !outreachDraft ? (
          <div style={{ marginTop: 8, color: color.textSecondary, fontSize: 12 }}>Track emails, LinkedIn messages, calls, and in-person touchpoints here.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outreach.map(entry => (
              <li key={entry.id} style={{ padding: 11, borderRadius: radius.input, border: `1px solid ${color.rowDivider}`, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: color.textBodyMid }}>
                      {CHANNELS.find(channel => channel.value === entry.channel)?.label ?? entry.channel}
                      {entry.contactName ? ` · ${entry.contactName}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: color.textMuted, marginTop: 2 }}>{formatDateTime(entry.occurredAt)}</div>
                    {entry.note ? <div style={{ marginTop: 6, fontSize: 11.5, color: color.textSecondary, whiteSpace: 'pre-wrap' }}>{entry.note}</div> : null}
                    {entry.nextFollowUpAt ? (
                      <div style={{ marginTop: 6, fontSize: 11, color: color.accent, fontWeight: 600 }}>Follow up {formatDateTime(entry.nextFollowUpAt)}</div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SmallButton onClick={() => setOutreachDraft({
                      ...entry,
                      contactId: entry.contactId ?? '',
                      occurredAt: toLocalDateTimeInput(entry.occurredAt),
                      nextFollowUpAt: entry.nextFollowUpAt ? toLocalDateInput(entry.nextFollowUpAt) : '',
                    })}>Edit</SmallButton>
                    <SmallButton danger onClick={() => runMutation(() => api.deleteOutreach(jobId, entry.id))}>Delete</SmallButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
