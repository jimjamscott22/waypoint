import { color, font, radius } from '../theme';

export default function Toast({ toast, onUndo, onDismiss, drawerOpen = false }) {
  if (!toast) return null;

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      style={{
        position: 'fixed',
        zIndex: 30,
        right: drawerOpen ? 434 : 24,
        bottom: 24,
        maxWidth: 390,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: color.ink,
        border: `1px solid ${toast.tone === 'error' ? color.urgent : 'rgba(255,255,255,0.14)'}`,
        borderRadius: radius.statCard,
        boxShadow: '0 14px 36px rgba(28,39,52,0.24)',
        color: '#fff',
        font: `500 12.5px ${font.body}`,
        transition: 'right 160ms ease',
      }}
    >
      <span style={{ lineHeight: 1.45 }}>{toast.message}</span>
      {toast.action === 'undo-delete' ? (
        <button
          type="button"
          onClick={onUndo}
          style={{ border: 'none', background: 'transparent', color: color.accentLight, font: `700 12.5px ${font.body}`, cursor: 'pointer', padding: 2 }}
        >
          Undo
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        style={{ border: 'none', background: 'transparent', color: color.sidebarText, fontSize: 17, cursor: 'pointer', padding: 0 }}
      >
        ×
      </button>
    </div>
  );
}
