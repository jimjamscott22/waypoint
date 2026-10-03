import { useRef, useState } from 'react';
import { api } from '../lib/apiClient';
import { color, font, radius } from '../theme';

const STARTERS = [
  'What should I do today?',
  'Which applications have gone quiet?',
  'Summarize my 90-day outcomes and top recommendations.',
  'How are my saved searches performing?',
];

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '92%',
        padding: '10px 12px',
        borderRadius: radius.input,
        background: isUser ? color.accent : color.inputBg,
        color: isUser ? '#fff' : color.textBodyMid,
        border: isUser ? 'none' : `1px solid ${color.rowDivider}`,
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}>
        {message.content}
      </div>
    </div>
  );
}

export default function AssistantView({ configured, layoutMode }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const mobile = layoutMode === 'mobile';

  const send = async text => {
    const content = (text ?? draft).trim();
    if (!content || loading) return;
    setError(null);
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    try {
      const result = await api.assistantChat(nextMessages);
      setMessages([...nextMessages, result.message]);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    } catch (sendError) {
      setError(sendError.message);
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  };

  if (!configured) {
    return (
      <section style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: mobile ? 20 : 28, maxWidth: 720 }}>
        <h1 style={{ margin: 0, font: `650 ${mobile ? 26 : 32}px ${font.heading}`, color: color.ink, letterSpacing: '-0.8px' }}>Coach</h1>
        <p style={{ margin: '10px 0 0', color: color.textSecondary, fontSize: 13.5, lineHeight: 1.55 }}>
          The in-app assistant is not configured yet. Set <code style={{ fontSize: 12 }}>ASSISTANT_BASE_URL</code> and <code style={{ fontSize: 12 }}>ASSISTANT_MODEL</code> in your environment (plus <code style={{ fontSize: 12 }}>ASSISTANT_API_KEY</code> for hosted providers). Local Ollama or LM Studio work with an OpenAI-compatible endpoint.
        </p>
        <p style={{ margin: '14px 0 0', color: color.textMuted, fontSize: 12 }}>Waypoint runs normally without the assistant — same pattern as optional Adzuna ingestion.</p>
      </section>
    );
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14, height: mobile ? 'auto' : 'calc(100vh - 120px)', minHeight: mobile ? 0 : 520 }}>
      <header>
        <div style={{ color: color.accent, font: `600 10px ${font.utility}`, letterSpacing: '1.1px', textTransform: 'uppercase' }}>Waypoint coach</div>
        <h1 style={{ margin: '6px 0 0', font: `650 ${mobile ? 26 : 34}px ${font.heading}`, color: color.ink, letterSpacing: '-0.9px' }}>Ask about your search</h1>
        <p style={{ margin: '8px 0 0', color: color.textSecondary, fontSize: 13, lineHeight: 1.5 }}>Grounded in your pipeline, follow-ups, insights, and outreach log. Drafts only — nothing is sent or saved server-side.</p>
      </header>

      <div ref={listRef} style={{ flex: 1, minHeight: mobile ? 280 : 0, overflowY: 'auto', background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 ? (
          <div style={{ color: color.textSecondary, fontSize: 12.5, lineHeight: 1.5 }}>
            Try a starter prompt:
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {STARTERS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.pill, background: '#fff', color: color.textBodyMid, padding: '7px 11px', font: `500 11px ${font.body}`, cursor: 'pointer' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
        {loading ? <div style={{ fontSize: 12, color: color.textMuted }}>Thinking with your Waypoint data…</div> : null}
        {error ? <div style={{ padding: '8px 10px', borderRadius: radius.input, background: '#fff0ee', color: color.urgent, fontSize: 12 }}>{error}</div> : null}
      </div>

      <form
        onSubmit={event => { event.preventDefault(); send(); }}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: 12 }}
      >
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: color.textMuted }}>
          Message
          <textarea
            rows={mobile ? 3 : 2}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="What should I focus on next?"
            style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.inputBg, color: color.ink, font: `400 13px ${font.body}`, padding: '10px 11px', resize: 'vertical', width: '100%' }}
          />
        </label>
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          style={{ border: 'none', borderRadius: radius.input, background: color.accent, color: '#fff', font: `600 12.5px ${font.body}`, padding: '10px 14px', minHeight: 42, cursor: loading ? 'wait' : 'pointer', opacity: loading || !draft.trim() ? 0.6 : 1 }}
        >
          Send
        </button>
      </form>
    </section>
  );
}
