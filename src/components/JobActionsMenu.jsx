import { useEffect, useRef, useState } from 'react';
import { color, font, radius } from '../theme';

const menuButtonStyle = {
  border: 'none',
  background: 'transparent',
  borderRadius: radius.badge,
  color: color.textBodyMid,
  cursor: 'pointer',
  font: `500 12px ${font.body}`,
  padding: '7px 10px',
  textAlign: 'left',
  width: '100%',
};

export default function JobActionsMenu({ onEdit, onDuplicate, onMoveUp, onMoveDown, onDelete, canMoveUp, canMoveDown }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeFromOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeFromEscape = event => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [open]);

  const runAction = action => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Job actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={event => {
          event.stopPropagation();
          setOpen(value => !value);
        }}
        style={{
          width: 28,
          height: 28,
          border: `1px solid ${open ? color.inputBorder : 'transparent'}`,
          borderRadius: radius.badge,
          background: open ? color.inputBg : 'transparent',
          color: color.textSecondary,
          cursor: 'pointer',
          font: `700 16px ${font.body}`,
          lineHeight: 1,
        }}
      >
        •••
      </button>
      {open ? (
        <div
          role="menu"
          onClick={event => event.stopPropagation()}
          style={{
            position: 'absolute',
            zIndex: 5,
            top: 32,
            right: 0,
            width: 150,
            background: color.cardBg,
            border: `1px solid ${color.cardBorder}`,
            borderRadius: radius.input,
            boxShadow: '0 10px 28px rgba(28,39,52,0.14)',
            padding: 5,
          }}
        >
          <button type="button" role="menuitem" onClick={() => runAction(onEdit)} style={menuButtonStyle}>Edit details</button>
          <button type="button" role="menuitem" onClick={() => runAction(onDuplicate)} style={menuButtonStyle}>Duplicate</button>
          <button
            type="button"
            role="menuitem"
            disabled={!canMoveUp}
            onClick={() => runAction(onMoveUp)}
            style={{ ...menuButtonStyle, opacity: canMoveUp ? 1 : 0.42, cursor: canMoveUp ? 'pointer' : 'not-allowed' }}
          >
            Move up
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canMoveDown}
            onClick={() => runAction(onMoveDown)}
            style={{ ...menuButtonStyle, opacity: canMoveDown ? 1 : 0.42, cursor: canMoveDown ? 'pointer' : 'not-allowed' }}
          >
            Move down
          </button>
          <div style={{ height: 1, background: color.rowDivider, margin: '4px 0' }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onDelete)}
            style={{ ...menuButtonStyle, color: color.urgent }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
