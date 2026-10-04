import { color, font, radius } from '../theme';

export default function MigrationBanner({ count, error, onImport, onDiscard }) {
  return (
    <div role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: color.warningBg, border: `1px solid ${color.warningBorder}`, borderRadius: radius.card, padding: '12px 16px', color: color.textBodyMid }}>
      <div><strong style={{ font: `600 13px ${font.heading}` }}>Import browser jobs?</strong><span style={{ marginLeft: 7, fontSize: 12.5 }}>{error || `This browser has ${count} local job${count === 1 ? '' : 's'} and the shared server is empty.`}</span></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onDiscard} style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.cardBg, color: color.textMuted, padding: '7px 10px', cursor: 'pointer' }}>Discard local data</button>
        {!error && count ? <button type="button" onClick={onImport} style={{ border: 'none', borderRadius: radius.input, background: color.accent, color: color.onAccent, padding: '7px 11px', cursor: 'pointer' }}>Import to server</button> : null}
      </div>
    </div>
  );
}
