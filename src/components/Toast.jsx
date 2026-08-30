import { color, font, radius } from '../theme';

export default function Toast({ toast, onUndo, onDismiss, drawerOpen = false, layoutMode }) {
  if (!toast) return null;
  const mobile = layoutMode === 'mobile';

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
      style={{
        position: 'fixed',
        zIndex: 30,
        left: mobile ? 16 : 'auto',
        right: mobile ? 16 : drawerOpen ? 444 : 24,
        bottom: mobile ? 84 : 24,
        maxWidth: mobile ? 'none' : 390,
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
