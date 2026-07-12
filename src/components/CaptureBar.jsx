import { useState } from 'react';
import { color, font, radius } from '../theme';

const SAVED_QUERIES = ['Sysadmin · remote · <7 days', 'IT support · Madison · <14 days', 'Network admin · hybrid'];

function QueryChip({ label }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? color.accent : color.inputBorder}`,
        borderRadius: radius.pill,
        padding: '4px 11px',
        fontSize: 12,
        color: hovered ? color.accent : color.textBodyMid,
        cursor: 'pointer',
        background: '#fff',
        transition: 'border-color 120ms ease, color 120ms ease',
      }}
    >
      {label}
    </span>
  );
}

function NewQueryChip() {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px dashed ${hovered ? color.accent : color.dashedBorder}`,
        borderRadius: radius.pill,
        padding: '4px 11px',
        fontSize: 12,
        color: hovered ? color.accent : color.textMuted,
        cursor: 'pointer',
        transition: 'border-color 120ms ease, color 120ms ease',
      }}
    >
      + New query
    </span>
  );
}

export default function CaptureBar({ onCapture }) {
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
          placeholder="Paste a job posting URL — title, company, salary and location fill in automatically"
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: color.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          Saved queries
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SAVED_QUERIES.map(label => (
            <QueryChip key={label} label={label} />
          ))}
          <NewQueryChip />
        </div>
      </div>
    </div>
  );
}
