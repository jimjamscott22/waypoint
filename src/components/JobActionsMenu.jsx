import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { color, font, radius, shadow } from '../theme';
import { overlayPosition } from '../lib/overlayPosition.js';

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
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const positionPanel = useCallback(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;
    // Measure unconstrained content before choosing which side has more space.
    panel.style.maxHeight = 'none';
    const position = overlayPosition(trigger.getBoundingClientRect(), {
      width: panel.offsetWidth, height: panel.offsetHeight,
    }, { width: document.documentElement.clientWidth, height: window.innerHeight });
    Object.assign(panel.style, {
      left: `${position.left}px`, top: `${position.top}px`, maxHeight: `${position.maxHeight}px`,
    });
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    const beforeToggle = event => { if (event.newState === 'open') requestAnimationFrame(positionPanel); };
    const toggle = event => setOpen(event.newState === 'open');
    panel.addEventListener('beforetoggle', beforeToggle);
    panel.addEventListener('toggle', toggle);
    return () => {
      panel.removeEventListener('beforetoggle', beforeToggle);
      panel.removeEventListener('toggle', toggle);
    };
  }, [positionPanel]);

  useEffect(() => {
    if (!open) return undefined;
    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open, positionPanel]);

  const runAction = action => {
    panelRef.current.hidePopover();
    triggerRef.current?.focus();
    action();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Job actions"
        ref={triggerRef}
        popovertarget={panelId}
        aria-controls={panelId}
        aria-expanded={open}
        onClick={event => event.stopPropagation()}
        style={{
          width: 40,
          height: 40,
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
      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="group"
        aria-label="Job actions"
        onClick={event => event.stopPropagation()}
        style={{
          position: 'fixed',
          inset: 'auto',
          overflowY: 'auto',
          maxWidth: 'calc(100vw - 16px)',
          width: 150,
          background: color.cardBg,
          border: `1px solid ${color.cardBorder}`,
          borderRadius: radius.input,
          boxShadow: shadow.raised,
          padding: 5,
        }}
      >
        <button type="button" onClick={() => runAction(onEdit)} style={menuButtonStyle}>Edit details</button>
        <button type="button" onClick={() => runAction(onDuplicate)} style={menuButtonStyle}>Duplicate</button>
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => runAction(onMoveUp)}
          style={{ ...menuButtonStyle, opacity: canMoveUp ? 1 : 0.42, cursor: canMoveUp ? 'pointer' : 'not-allowed' }}
        >
          Move up
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => runAction(onMoveDown)}
          style={{ ...menuButtonStyle, opacity: canMoveDown ? 1 : 0.42, cursor: canMoveDown ? 'pointer' : 'not-allowed' }}
        >
          Move down
        </button>
        <div style={{ height: 1, background: color.rowDivider, margin: '4px 0' }} />
        <button
          type="button"
          onClick={() => runAction(onDelete)}
          style={{ ...menuButtonStyle, color: color.urgent }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
