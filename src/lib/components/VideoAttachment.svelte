<script lang="ts" context="module">
  const generatedPosters = new Map<string, Promise<string>>();

  function generatedPosterFor(url: string) {
    if (!generatedPosters.has(url)) generatedPosters.set(url, captureVideoPoster(url));
    return generatedPosters.get(url) ?? Promise.resolve('');
  }

  function captureVideoPoster(url: string) {
    return new Promise<string>((resolve) => {
      if (typeof document === 'undefined') {
        resolve('');
        return;
      }

      const video = document.createElement('video');
      const timeout = setTimeout(() => finish(''), 10_000);
      let settled = false;

      const finish = (poster: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        video.removeAttribute('src');
        video.load();
        resolve(poster);
      };

      const drawFrame = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) {
          finish('');
          return;
        }

        try {
          const maxWidth = 640;
          const scale = Math.min(1, maxWidth / width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            finish('');
            return;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL('image/jpeg', 0.76));
        } catch {
          finish('');
        }
      };

      const seekToFrame = () => {
        if (settled) return;
        const targetTime = Number.isFinite(video.duration) && video.duration > 0.25 ? 0.12 : 0;
        if (targetTime <= 0) {
          drawFrame();
          return;
        }
        try {
          video.currentTime = targetTime;
        } catch {
          drawFrame();
        }
      };

      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.addEventListener('loadedmetadata', seekToFrame, { once: true });
      video.addEventListener('loadeddata', () => {
        if (video.currentTime === 0) drawFrame();
      }, { once: true });
      video.addEventListener('seeked', drawFrame, { once: true });
      video.addEventListener('error', () => finish(''), { once: true });
      video.src = url;
      video.load();
    });
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { pauseWhenHidden } from '$lib/actions/pauseWhenHidden';
  import { prefersLeanMedia } from '$lib/clientCapabilities';

  export let src: string;
  export let poster: string | undefined = undefined;
  export let title: string | undefined = undefined;

  let wrapper: HTMLDivElement;
  let generatedPoster = '';
  let active = false;
  let leanMedia = false;
  let destroyed = false;
  let posterRequestKey = '';
  let observer: IntersectionObserver | undefined;
  $: displayPoster = poster || generatedPoster || undefined;
  $: if (active && !leanMedia && !poster && src !== posterRequestKey) {
    posterRequestKey = src;
    void generatedPosterFor(src).then((nextPoster) => {
      if (!destroyed && nextPoster && posterRequestKey === src) generatedPoster = nextPoster;
    });
  }

  onMount(() => {
    leanMedia = prefersLeanMedia();
    if (!('IntersectionObserver' in window)) {
      active = true;
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          active = true;
          observer?.disconnect();
        },
        { rootMargin: leanMedia ? '240px 0px' : '720px 0px' }
      );
      observer.observe(wrapper);
    }
    return () => {
      destroyed = true;
      observer?.disconnect();
    };
  });
</script>

<div class="video-attachment" bind:this={wrapper}>
  {#if active}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video use:pauseWhenHidden src={src} poster={displayPoster} controls preload={leanMedia ? 'none' : 'metadata'} playsinline {title}></video>
  {:else}
    <div class="video-placeholder" aria-label={title || 'Video'}>
      <span>Video</span>
    </div>
  {/if}
</div>
