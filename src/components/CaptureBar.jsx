import { useState } from 'react';
import { color, font, radius } from '../theme';
import SavedQueries from './SavedQueries';

export default function CaptureBar({
  onCapture,
  queries,
  onCreateQuery,
  onUpdateQuery,
  onDeleteQuery,
  focusQueryId,
  onFocusQueryHandled,
}) {
  const [url, setUrl] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);

  const handleCapture = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onCapture(trimmed);
    setUrl('');
  };

  return (
    <div
      style={{
        background: color.cardBg,
        border: `1px solid ${color.cardBorder}`,
        borderRadius: radius.card,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCapture();
          }}
          placeholder="Paste a job posting URL to create an editable draft"
          style={{
            flex: 1,
            border: `1px solid ${inputFocused ? color.accent : color.inputBorder}`,
            borderRadius: radius.input,
            padding: '10px 14px',
            font: `400 13px ${font.body}`,
            color: color.ink,
            background: inputFocused ? '#fff' : color.inputBg,
            outline: 'none',
            transition: 'border-color 120ms ease, background 120ms ease',
          }}
        />
        <button
          onClick={handleCapture}
          onMouseEnter={() => setButtonHovered(true)}
          onMouseLeave={() => setButtonHovered(false)}
          style={{
            flex: 'none',
            border: 'none',
            borderRadius: radius.input,
            background: color.accent,
            color: '#fff',
            font: `600 13px ${font.body}`,
            padding: '0 18px',
            cursor: 'pointer',
            filter: buttonHovered ? 'brightness(1.08)' : 'none',
            transition: 'filter 120ms ease',
          }}
        >
          Capture job
        </button>
      </div>
      <SavedQueries
        queries={queries}
        onCreate={onCreateQuery}
        onUpdate={onUpdateQuery}
        onDelete={onDeleteQuery}
        focusQueryId={focusQueryId}
        onFocusHandled={onFocusQueryHandled}
      />
    </div>
  );
}
