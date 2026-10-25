// Keep the disclosure inside the viewport, including short/mobile viewports.
export function overlayPosition(trigger, panel, viewport, margin = 8) {
  const availableBelow = viewport.height - trigger.bottom - margin;
  const availableAbove = trigger.top - margin;
  const above = panel.height > availableBelow && availableAbove > availableBelow;
  const maxHeight = Math.max(0, Math.min(viewport.height - margin * 2, (above ? availableAbove : availableBelow) - margin));
  const height = Math.min(panel.height, maxHeight);
  const top = above ? trigger.top - height - margin : trigger.bottom + margin;
  return {
    left: Math.max(margin, Math.min(trigger.right - panel.width, viewport.width - panel.width - margin)),
    top: Math.max(margin, Math.min(top, viewport.height - height - margin)),
    maxHeight,
  };
}
