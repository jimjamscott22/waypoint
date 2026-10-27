import { useEffect, useId, useRef } from 'react';
import { color, font, radius, shadow } from '../theme';

export default function JobHuntingTipPopup({ tipState, onNextTip, onClose, layoutMode }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();
  const mobile = layoutMode === 'mobile';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const returnFocusTo = document.activeElement;
    let active = true;

    const closed = async () => {
      if (dialog.open) return;
      await Promise.allSettled(dialog.getAnimations().map(animation => animation.finished));
      if (active) onClose();
    };

    let startedOutside = false;
    const outside = event => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.target === dialog &&
        (event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom)
      );
    };
    const pointerDown = event => {
      startedOutside = outside(event);
    };
    const lightDismiss = event => {
      if (startedOutside && outside(event)) dialog.close();
      startedOutside = false;
    };

    dialog.addEventListener('close', closed);
    if (!('closedBy' in dialog)) {
      dialog.addEventListener('pointerdown', pointerDown);
      dialog.addEventListener('click', lightDismiss);
    }
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      active = false;
      dialog.removeEventListener('close', closed);
      dialog.removeEventListener('pointerdown', pointerDown);
      dialog.removeEventListener('click', lightDismiss);
      if (dialog.open) dialog.close();
      if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) returnFocusTo.focus();
    };
  }, [onClose]);

  if (!tipState?.tip) return null;

  const { tip, index, total } = tipState;

  return (
    <dialog
      ref={dialogRef}
      data-tip-modal
      closedby="any"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      style={{
        width: mobile ? 'calc(100vw - 28px)' : 420,
        maxWidth: 'calc(100vw - 28px)',
        background: color.cardBg,
        color: color.ink,
        border: `1px solid ${color.cardBorder}`,
        borderRadius: radius.card,
        boxShadow: shadow.raised,
        padding: mobile ? '18px 18px 16px' : '22px 24px 20px',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              borderRadius: radius.pill,
              padding: '3px 9px',
              background: color.accentSoft,
              color: color.accent,
              font: `700 10px ${font.utility}`,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
            }}
          >
            Job Search Tip · {index + 1} of {total}
          </span>
          {tip.category ? (
            <span
              style={{
                borderRadius: radius.pill,
                padding: '3px 8px',
                background: color.tideglass,
                color: color.ink,
                font: `600 10px ${font.body}`,
              }}
            >
              {tip.category}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close job hunting tip"
          onClick={() => dialogRef.current?.close()}
          style={{
            border: 'none',
            borderRadius: radius.smallButton,
            background: 'transparent',
            color: color.textMuted,
            fontSize: 19,
            cursor: 'pointer',
            width: 34,
            height: 34,
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <h2
          id={titleId}
          style={{
            margin: 0,
            color: color.ink,
            font: `650 17px ${font.heading}`,
            lineHeight: 1.3,
          }}
        >
          {tip.title}
        </h2>
        <p
          id={bodyId}
          style={{
            margin: 0,
            color: color.textBodyMid,
            font: `400 13px ${font.body}`,
            lineHeight: 1.55,
          }}
        >
          {tip.body}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingTop: 12,
          borderTop: `1px solid ${color.rowDivider}`,
        }}
      >
        <button
          type="button"
          onClick={onNextTip}
          style={{
            border: `1px solid ${color.inputBorder}`,
            borderRadius: radius.input,
            background: color.inputBg,
            color: color.textBodyMid,
            font: `600 12px ${font.body}`,
            minHeight: 38,
            padding: '7px 12px',
            cursor: 'pointer',
          }}
        >
          Next tip
        </button>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => dialogRef.current?.close()}
          style={{
            border: 'none',
            borderRadius: radius.input,
            background: color.accent,
            color: color.onAccent,
            font: `600 12.5px ${font.body}`,
            minHeight: 38,
            padding: '7px 16px',
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </dialog>
  );
}
