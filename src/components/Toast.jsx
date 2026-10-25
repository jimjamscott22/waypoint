import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { color, font, radius, shadow } from '../theme';

export default function Toast({ toast, onUndo, onDismiss, onPause, onResume, container, drawerOpen = false, layoutMode }) {
  const surfaceRef = useRef(null);
  const [lastToast, setLastToast] = useState(toast);
  const [announcement, setAnnouncement] = useState(null);
  const visibleToast = toast ?? lastToast;
  const mobile = layoutMode === 'mobile';

  useEffect(() => {
    const surface = surfaceRef.current;
    if (toast) {
      setLastToast(toast);
      if (!surface.matches(':popover-open')) surface.showPopover();
      if (surface.matches(':hover')) onPause('pointer');
      if (surface.contains(document.activeElement)) onPause('focus');
    } else if (surface.matches(':popover-open')) {
      surface.hidePopover();
    }
    // Announce after the empty live regions have been registered, including when
    // moving into a newly opened modal or repeating the same notification text.
    setAnnouncement(null);
    const timeout = setTimeout(() => setAnnouncement(toast), 0);
    return () => {
      clearTimeout(timeout);
      onResume('pointer');
      onResume('focus');
    };
  }, [toast, container, onPause, onResume]);

  return createPortal(
    <>
      <span data-visually-hidden role="status" aria-atomic="true">{announcement?.tone !== 'error' ? announcement?.message : ''}</span>
      <span data-visually-hidden role="alert" aria-atomic="true">{announcement?.tone === 'error' ? announcement.message : ''}</span>
      <div
        ref={surfaceRef}
        popover="manual"
        data-toast
        role="group"
        aria-label="Notification"
        onPointerEnter={() => onPause('pointer')}
        onPointerLeave={() => onResume('pointer')}
        onFocus={() => onPause('focus')}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onResume('focus'); }}
        style={{
          position: 'fixed',
          inset: 'auto',
          left: mobile ? 16 : 'auto',
          right: mobile ? 16 : drawerOpen && layoutMode === 'wide' ? 444 : 24,
          bottom: mobile ? 84 : 24,
          maxWidth: mobile ? 'none' : 'min(390px, calc(100vw - 32px))',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: color.toastBg,
          border: `1px solid ${visibleToast?.tone === 'error' ? color.urgent : color.toastBorder}`,
          borderRadius: radius.statCard,
          boxShadow: shadow.raised,
          color: color.toastText,
          font: `500 12.5px ${font.body}`,
        }}
      >
        <span style={{ lineHeight: 1.45 }}>{visibleToast?.message}</span>
        {visibleToast?.action === 'undo-delete' ? (
          <button type="button" onClick={onUndo} style={{ border: 'none', background: 'transparent', color: color.accentLight, font: `700 12.5px ${font.body}`, cursor: 'pointer', padding: '8px 2px' }}>Undo</button>
        ) : null}
        <button type="button" aria-label="Dismiss notification" onClick={onDismiss} style={{ border: 'none', background: 'transparent', color: color.sidebarText, fontSize: 17, cursor: 'pointer', minWidth: 32, minHeight: 32, padding: 0 }}>×</button>
      </div>
    </>,
    container ?? document.body
  );
}
