export function shouldSubmitTextareaOnEnter(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
  return !isTouchKeyboardLikely();
}

function isTouchKeyboardLikely() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}
