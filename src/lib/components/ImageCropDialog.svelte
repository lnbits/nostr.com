<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { ImagePlus, Loader2, RotateCcw, X } from '@lucide/svelte';

  export let file: File;
  export let uploading = false;

  const dispatch = createEventDispatcher<{ close: void; crop: File }>();
  const cropCanvasSize = 900;
  const cropOutputMime = 'image/jpeg';
  const cropResizeHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  let loadedFile: File | undefined;
  let cropImageUrl = '';
  let cropImageElement: HTMLImageElement;
  let cropFrameElement: HTMLElement;
  let cropImageNaturalWidth = 0;
  let cropImageNaturalHeight = 0;
  let cropX = 0;
  let cropY = 0;
  let cropWidth = 100;
  let cropHeight = 100;
  let draggingCrop = false;
  let resizingCropHandle = '';
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartCropX = 0;
  let resizeStartCropY = 0;
  let resizeStartCropWidth = 0;
  let resizeStartCropHeight = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let error = '';

  $: if (file && file !== loadedFile) openCropper(file);
  $: cropBoxStyle = `left: ${cropX}%; top: ${cropY}%; width: ${cropWidth}%; height: ${cropHeight}%;`;
  $: cropFrameStyle = cropImageNaturalWidth && cropImageNaturalHeight ? `aspect-ratio: ${cropImageNaturalWidth} / ${cropImageNaturalHeight};` : '';

  onDestroy(() => revokeCropImageUrl());

  function openCropper(nextFile: File) {
    loadedFile = nextFile;
    revokeCropImageUrl();
    cropImageUrl = URL.createObjectURL(nextFile);
    cropImageNaturalWidth = 0;
    cropImageNaturalHeight = 0;
    resetCrop();
    error = '';
  }

  function revokeCropImageUrl() {
    if (!cropImageUrl) return;
    URL.revokeObjectURL(cropImageUrl);
    cropImageUrl = '';
  }

  function close() {
    dispatch('close');
  }

  function resetCrop() {
    cropX = 0;
    cropY = 0;
    cropWidth = 100;
    cropHeight = 100;
  }

  function startCropDrag(event: PointerEvent) {
    if (resizingCropHandle) return;
    event.preventDefault();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffsetX = event.clientX - box.left;
    dragOffsetY = event.clientY - box.top;
    draggingCrop = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function dragCrop(event: PointerEvent) {
    if (!draggingCrop) return;
    const frame = cropFrameElement?.getBoundingClientRect();
    if (!frame?.width || !frame.height) return;
    const nextX = ((event.clientX - frame.left - dragOffsetX) / frame.width) * 100;
    const nextY = ((event.clientY - frame.top - dragOffsetY) / frame.height) * 100;
    cropX = clamp(nextX, 0, 100 - cropWidth);
    cropY = clamp(nextY, 0, 100 - cropHeight);
  }

  function stopCropDrag(event: PointerEvent) {
    draggingCrop = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function startCropResize(event: PointerEvent, handle: string) {
    event.preventDefault();
    event.stopPropagation();
    resizingCropHandle = handle;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    resizeStartCropX = cropX;
    resizeStartCropY = cropY;
    resizeStartCropWidth = cropWidth;
    resizeStartCropHeight = cropHeight;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function resizeCrop(event: PointerEvent) {
    if (!resizingCropHandle) return;
    const frame = cropFrameElement?.getBoundingClientRect();
    if (!frame?.width || !frame.height) return;
    const deltaX = ((event.clientX - resizeStartX) / frame.width) * 100;
    const deltaY = ((event.clientY - resizeStartY) / frame.height) * 100;
    const next = resizedCropBox(resizingCropHandle, deltaX, deltaY);
    cropX = next.x;
    cropY = next.y;
    cropWidth = next.width;
    cropHeight = next.height;
  }

  function stopCropResize(event: PointerEvent) {
    resizingCropHandle = '';
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function resizedCropBox(handle: string, deltaX: number, deltaY: number) {
    const minSize = 12;
    let x = resizeStartCropX;
    let y = resizeStartCropY;
    let width = resizeStartCropWidth;
    let height = resizeStartCropHeight;
    if (handle.includes('w')) {
      x = clamp(resizeStartCropX + deltaX, 0, resizeStartCropX + resizeStartCropWidth - minSize);
      width = resizeStartCropWidth + resizeStartCropX - x;
    }
    if (handle.includes('e')) width = clamp(resizeStartCropWidth + deltaX, minSize, 100 - resizeStartCropX);
    if (handle.includes('n')) {
      y = clamp(resizeStartCropY + deltaY, 0, resizeStartCropY + resizeStartCropHeight - minSize);
      height = resizeStartCropHeight + resizeStartCropY - y;
    }
    if (handle.includes('s')) height = clamp(resizeStartCropHeight + deltaY, minSize, 100 - resizeStartCropY);
    return { x, y, width, height };
  }

  async function uploadCrop() {
    try {
      error = '';
      dispatch('crop', await croppedImageFile());
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not crop image.';
    }
  }

  async function croppedImageFile() {
    if (!cropImageElement || !cropImageNaturalWidth || !cropImageNaturalHeight) throw new Error('Image is still loading.');
    const source = cropSourceRect();
    const scale = Math.min(1, cropCanvasSize / Math.max(source.width, source.height));
    const outputWidth = Math.max(1, Math.round(source.width * scale));
    const outputHeight = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare image crop.');
    context.drawImage(cropImageElement, source.x, source.y, source.width, source.height, 0, 0, outputWidth, outputHeight);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Could not export cropped image.'))), cropOutputMime, 0.92);
    });
    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${name}-cropped.jpg`, { type: cropOutputMime });
  }

  function cropSourceRect() {
    return {
      x: (cropX / 100) * cropImageNaturalWidth,
      y: (cropY / 100) * cropImageNaturalHeight,
      width: (cropWidth / 100) * cropImageNaturalWidth,
      height: (cropHeight / 100) * cropImageNaturalHeight
    };
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
</script>

<div class="dialog-backdrop crop-dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !uploading && close()}>
  <div class="dialog-panel crop-dialog" role="dialog" aria-modal="true" aria-label="Crop image">
    <div class="dialog-head">
      <h2>Crop image</h2>
      <button class="icon-button" disabled={uploading} on:click={close} aria-label="Close cropper"><X size={20} /></button>
    </div>
    <div class="crop-frame" bind:this={cropFrameElement}>
      <img
        bind:this={cropImageElement}
        src={cropImageUrl}
        style={cropFrameStyle}
        alt=""
        on:load={() => {
          cropImageNaturalWidth = cropImageElement.naturalWidth;
          cropImageNaturalHeight = cropImageElement.naturalHeight;
          resetCrop();
        }}
      />
      <div
        class="crop-box"
        style={cropBoxStyle}
        role="presentation"
        on:pointerdown={startCropDrag}
        on:pointermove={dragCrop}
        on:pointerup={stopCropDrag}
        on:pointercancel={stopCropDrag}
      >
        {#each cropResizeHandles as handle}
          <button
            type="button"
            class={`crop-handle ${handle}`}
            aria-label={`Resize crop ${handle}`}
            on:pointerdown={(event) => startCropResize(event, handle)}
            on:pointermove={resizeCrop}
            on:pointerup={stopCropResize}
            on:pointercancel={stopCropResize}
          ></button>
        {/each}
      </div>
    </div>
    <div class="crop-controls">
      <span>Drag the edges or corners to crop.</span>
      <button type="button" class="icon-button" disabled={uploading} on:click={resetCrop} aria-label="Reset crop"><RotateCcw size={18} /></button>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="composer-actions">
      <button type="button" disabled={uploading} on:click={close}>Cancel</button>
      <button type="button" class="primary" disabled={uploading || !cropImageNaturalWidth} on:click={uploadCrop}>
        {#if uploading}<Loader2 size={18} class="spin" />{:else}<ImagePlus size={18} />{/if}
        Upload crop
      </button>
    </div>
  </div>
</div>
