<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let url = '';
  export let alt = '';
  export let referrerpolicy: ReferrerPolicy | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void }>();
  const minScale = 1;
  const maxScale = 5;
  const tapMovementThreshold = 8;

  let viewerElement: HTMLDivElement;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let lastUrl = '';
  let lastDistance = 0;
  let lastCenter = { x: 0, y: 0 };
  let tapStart = { x: 0, y: 0 };
  let moved = false;
  let pointers = new Map<number, { x: number; y: number }>();

  $: if (url && url !== lastUrl) {
    lastUrl = url;
    resetZoom();
  }

  $: imageTransform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;

  function close() {
    dispatch('close');
  }

  function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    lastDistance = 0;
    lastCenter = { x: 0, y: 0 };
    pointers = new Map();
    moved = false;
  }

  function pointerDown(event: PointerEvent) {
    viewerElement?.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved = false;

    if (pointers.size === 1) {
      tapStart = { x: event.clientX, y: event.clientY };
    } else if (pointers.size === 2) {
      event.preventDefault();
      lastDistance = pointerDistance();
      lastCenter = pointerCenter();
    }
  }

  function pointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId) ?? { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) > tapMovementThreshold) moved = true;

    if (pointers.size >= 2) {
      event.preventDefault();
      const nextDistance = pointerDistance();
      const nextCenter = pointerCenter();
      if (lastDistance > 0) zoomAround(nextCenter, scale * (nextDistance / lastDistance));
      translateX += nextCenter.x - lastCenter.x;
      translateY += nextCenter.y - lastCenter.y;
      constrainPan();
      lastDistance = nextDistance;
      lastCenter = nextCenter;
      return;
    }

    if (scale > minScale) {
      event.preventDefault();
      translateX += event.clientX - previous.x;
      translateY += event.clientY - previous.y;
      constrainPan();
    }
  }

  function pointerUp(event: PointerEvent) {
    viewerElement?.releasePointerCapture?.(event.pointerId);
    const wasTap = !moved && pointers.size === 1 && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) <= tapMovementThreshold;
    pointers.delete(event.pointerId);

    if (pointers.size < 2) {
      lastDistance = 0;
      lastCenter = { x: 0, y: 0 };
    }

    if (scale <= minScale) {
      resetZoom();
      if (wasTap) close();
    }
  }

  function pointerCancel(event: PointerEvent) {
    viewerElement?.releasePointerCapture?.(event.pointerId);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) lastDistance = 0;
  }

  function wheelZoom(event: WheelEvent) {
    if (!event.ctrlKey && Math.abs(event.deltaY) < 20) return;
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
    zoomAround({ x: event.clientX, y: event.clientY }, scale * zoomFactor);
    constrainPan();
  }

  function zoomAround(point: { x: number; y: number }, requestedScale: number) {
    const nextScale = clamp(requestedScale, minScale, maxScale);
    if (!viewerElement || nextScale === scale) return;
    const rect = viewerElement.getBoundingClientRect();
    const originX = point.x - rect.left - rect.width / 2;
    const originY = point.y - rect.top - rect.height / 2;
    const ratio = nextScale / scale;
    translateX = originX - (originX - translateX) * ratio;
    translateY = originY - (originY - translateY) * ratio;
    scale = nextScale;
    if (scale <= minScale) resetZoom();
  }

  function pointerDistance() {
    const [first, second] = [...pointers.values()];
    if (!first || !second) return 0;
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function pointerCenter() {
    const [first, second] = [...pointers.values()];
    if (!first || !second) return { x: first?.x ?? 0, y: first?.y ?? 0 };
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  function constrainPan() {
    if (!viewerElement || scale <= minScale) return;
    const rect = viewerElement.getBoundingClientRect();
    const maxX = (rect.width * (scale - 1)) / 2 + 80;
    const maxY = (rect.height * (scale - 1)) / 2 + 80;
    translateX = clamp(translateX, -maxX, maxX);
    translateY = clamp(translateY, -maxY, maxY);
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
</script>

<div class="dialog-backdrop image-viewer-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && close()}>
  <div
    bind:this={viewerElement}
    class="image-viewer"
    class:zoomed={scale > 1}
    role="dialog"
    aria-modal="true"
    aria-label="Image preview"
    tabindex="0"
    on:pointerdown={pointerDown}
    on:pointermove={pointerMove}
    on:pointerup={pointerUp}
    on:pointercancel={pointerCancel}
    on:wheel={wheelZoom}
    on:keydown={(event) => event.key === 'Escape' && close()}
  >
    <img src={url} alt={alt} {referrerpolicy} style:transform={imageTransform} draggable="false" />
  </div>
</div>
