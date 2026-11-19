import type {
  MediaAsset,
  OverlayEffectType,
  ProjectState,
  TimelineClip,
} from '../types/editor';
import {
  applyColorPipelineToPixels,
  computeTransitionState,
  getEffectiveColorGrade,
} from './colorPipeline';
import { evaluateClipTransformAtTime } from './keyframes';

export interface MediaResourceCache {
  images: Map<string, HTMLImageElement>;
  videos: Map<string, HTMLVideoElement>;
}

export function createMediaCache(): MediaResourceCache {
  return {
    images: new Map(),
    videos: new Map(),
  };
}

export function ensureAssetLoaded(
  asset: MediaAsset,
  cache: MediaResourceCache,
  onReady?: () => void
): HTMLImageElement | HTMLVideoElement | null {
  if (!asset.src) return null;

  if (asset.type === 'image') {
    const existing = cache.images.get(asset.id);
    if (existing) return existing.complete && existing.naturalWidth > 0 ? existing : null;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => onReady?.();
    img.src = asset.src;
    cache.images.set(asset.id, img);
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  if (asset.type === 'video') {
    const existing = cache.videos.get(asset.id);
    if (existing) return existing.readyState >= 2 ? existing : null;

    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'auto';
    vid.onloadeddata = () => onReady?.();
    vid.src = asset.src;
    cache.videos.set(asset.id, vid);
    return vid.readyState >= 2 ? vid : null;
  }

  return null;
}

function needsPixelProcessing(clip: TimelineClip): boolean {
  const g = clip.colorGrade;
  if (clip.filterPresetId && clip.filterPresetId !== 'none' && clip.filterIntensity > 0) {
    return true;
  }
  if (clip.chromaKey.enabled) return true;
  if (
    g.exposure !== 0 ||
    g.contrast !== 0 ||
    g.saturation !== 0 ||
    g.temperature !== 0 ||
    g.tint !== 0 ||
    g.gamma !== 1 ||
    g.highlights !== 0 ||
    g.shadows !== 0
  ) {
    return true;
  }
  const hasWheel = (w: typeof g.wheels.lift) =>
    w.r !== 0 || w.g !== 0 || w.b !== 0 || w.luma !== 0;
  if (hasWheel(g.wheels.lift) || hasWheel(g.wheels.gamma) || hasWheel(g.wheels.gain)) {
    return true;
  }
  const isDefaultCurve = (pts: { x: number; y: number }[]) =>
    pts.every((p) => Math.abs(p.x - p.y) < 0.005);
  if (
    !isDefaultCurve(g.curves.master) ||
    !isDefaultCurve(g.curves.red) ||
    !isDefaultCurve(g.curves.green) ||
    !isDefaultCurve(g.curves.blue)
  ) {
    return true;
  }
  return false;
}

// Reusable scratch canvas for per-clip pixel grading & masking
let scratchCanvas: HTMLCanvasElement | null = null;
function getScratchCanvas(w: number, h: number): HTMLCanvasElement {
  if (!scratchCanvas) {
    scratchCanvas = document.createElement('canvas');
  }
  if (scratchCanvas.width !== w || scratchCanvas.height !== h) {
    scratchCanvas.width = w;
    scratchCanvas.height = h;
  }
  return scratchCanvas;
}

function drawProceduralOverlay(
  ctx: CanvasRenderingContext2D,
  type: OverlayEffectType,
  w: number,
  h: number,
  time: number
) {
  ctx.save();
  switch (type) {
    case 'letterbox': {
      const barH = Math.round(h * 0.115);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);
      break;
    }
    case 'light-leak': {
      const shift = Math.sin(time * 1.4) * w * 0.12;
      const g1 = ctx.createRadialGradient(
        w * 0.15 + shift,
        h * 0.2,
        w * 0.04,
        w * 0.25 + shift,
        h * 0.35,
        w * 0.65
      );
      g1.addColorStop(0, 'rgba(255, 168, 76, 0.72)');
      g1.addColorStop(0.45, 'rgba(168, 85, 247, 0.38)');
      g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'bokeh': {
      for (let i = 0; i < 16; i++) {
        const bx = ((Math.sin(i * 4.3 + time * 0.25) * 0.5 + 0.5) * w) % w;
        const by = ((Math.cos(i * 2.9 + time * 0.18) * 0.5 + 0.5) * h) % h;
        const br = (18 + (i % 5) * 14) * (w / 960);
        const grad = ctx.createRadialGradient(bx, by, br * 0.1, bx, by, br);
        const hue = i % 2 === 0 ? '255, 215, 150' : '192, 132, 252';
        grad.addColorStop(0, `rgba(${hue}, 0.22)`);
        grad.addColorStop(0.8, `rgba(${hue}, 0.08)`);
        grad.addColorStop(1, `rgba(${hue}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'scanlines': {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1.5);
      }
      break;
    }
    case 'film-grain':
    case 'dust': {
      const count = type === 'film-grain' ? 280 : 65;
      for (let i = 0; i < count; i++) {
        const seed = Math.sin(i * 12.9898 + Math.floor(time * 24) * 78.233) * 43758.5453;
        const fx = seed - Math.floor(seed);
        const seed2 = Math.sin(i * 93.9898 + Math.floor(time * 24) * 17.13) * 19458.23;
        const fy = seed2 - Math.floor(seed2);
        const size = type === 'dust' ? 1.5 + (i % 3) : 1.2;
        ctx.fillStyle =
          i % 2 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(20,20,25,0.18)';
        ctx.fillRect(fx * w, fy * h, size, size);
      }
      break;
    }
  }
  ctx.restore();
}

function drawTitleClip(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  w: number,
  h: number,
  localTime: number
) {
  const style = clip.titleStyle;
  if (!style) return;

  const scaleRatio = w / 1280;
  const entryT = Math.min(1, localTime / 0.75);
  const easedEntry = 1 - Math.pow(1 - entryT, 3);

  let animY = 0;
  let animX = 0;
  let animAlpha = 1;
  let animScale = 1;
  let displayText = style.text;

  switch (clip.motionPreset) {
    case 'fade-in':
      animAlpha = easedEntry;
      break;
    case 'slide-up':
      animY = (1 - easedEntry) * 48 * scaleRatio;
      animAlpha = easedEntry;
      break;
    case 'slide-left':
      animX = (1 - easedEntry) * 72 * scaleRatio;
      animAlpha = easedEntry;
      break;
    case 'zoom-in':
      animScale = 0.85 + easedEntry * 0.15;
      animAlpha = easedEntry;
      break;
    case 'bounce': {
      const overshoot =
        entryT < 1 ? 1 + Math.sin(entryT * Math.PI) * 0.14 * (1 - entryT) : 1;
      animScale = Math.min(1.15, entryT * 1.1) * overshoot;
      animAlpha = Math.min(1, entryT * 2);
      break;
    }
    case 'typewriter': {
      const chars = Math.max(1, Math.floor(style.text.length * Math.min(1, localTime / 1.4)));
      displayText = style.text.slice(0, chars);
      break;
    }
  }

  ctx.save();
  ctx.globalAlpha *= animAlpha;
  ctx.translate(w / 2 + animX, h / 2 + animY);
  ctx.scale(animScale, animScale);

  const fontSize = Math.max(14, Math.round(style.fontSize * scaleRatio));
  const subSize = Math.max(11, Math.round(fontSize * 0.38));

  ctx.font = `${style.fontWeight} ${fontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textAlign = style.align;
  ctx.textBaseline = 'middle';

  const textX =
    style.align === 'left' ? -w * 0.4 : style.align === 'right' ? w * 0.4 : 0;
  const baseY = style.templateId === 'tpl_lower_third' ? h * 0.3 : 0;

  // Optional background box
  if (style.backgroundOpacity > 0) {
    const mainMetrics = ctx.measureText(displayText);
    const boxW = Math.min(w * 0.88, Math.max(mainMetrics.width + 64 * scaleRatio, 260 * scaleRatio));
    const boxH = style.subtitle ? (fontSize + subSize + 36 * scaleRatio) : (fontSize + 28 * scaleRatio);
    const boxX =
      style.align === 'left'
        ? textX - 24 * scaleRatio
        : style.align === 'right'
        ? textX - boxW + 24 * scaleRatio
        : -boxW / 2;
    const boxY = baseY - boxH / 2 + (style.subtitle ? subSize * 0.35 : 0);

    ctx.save();
    ctx.globalAlpha *= style.backgroundOpacity;
    ctx.fillStyle = style.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8 * scaleRatio);
    ctx.fill();
    ctx.restore();
  }

  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = style.shadowBlur * scaleRatio;
  ctx.shadowOffsetY = 2 * scaleRatio;

  if (style.strokeWidth > 0) {
    ctx.strokeStyle = style.strokeColor;
    ctx.lineWidth = style.strokeWidth * scaleRatio;
    ctx.strokeText(displayText, textX, baseY);
  }

  ctx.fillStyle = style.color;
  ctx.fillText(displayText, textX, baseY);

  if (style.subtitle && style.subtitle.trim().length > 0) {
    ctx.font = `500 ${subSize}px "DM Sans", sans-serif`;
    ctx.fillStyle = 'rgba(244, 244, 248, 0.86)';
    ctx.shadowBlur = 6 * scaleRatio;
    ctx.fillText(style.subtitle, textX, baseY + fontSize * 0.68);
  }

  ctx.restore();
}

export interface RenderOptions {
  bypassGrade?: boolean;
  showSafeGuides?: boolean;
  selectedClipId?: string | null;
  isPlaying?: boolean;
}

/**
 * Renders the complete multi-track timeline at `currentTime` onto `ctx`.
 */
export function renderTimelineFrame(
  ctx: CanvasRenderingContext2D,
  project: ProjectState,
  currentTime: number,
  cache: MediaResourceCache,
  onMediaReady?: () => void,
  options: RenderOptions = {}
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Clear to cinema black
  ctx.save();
  ctx.fillStyle = '#07060a';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Order tracks bottom-to-top for painter's compositing
  // Tracks array in UI has top track at index 0 (T1, V2, V1, A1...), so reverse for bottom-up drawing.
  const visualTracks = [...project.tracks]
    .filter((t) => t.type !== 'audio' && !t.hidden)
    .reverse();

  const assetsById = new Map(project.assets.map((a) => [a.id, a]));

  for (const track of visualTracks) {
    const activeClips = project.clips.filter(
      (c) =>
        c.trackId === track.id &&
        currentTime >= c.startTime &&
        currentTime < c.startTime + c.duration
    );

    for (const clip of activeClips) {
      const localTime = Math.max(0, currentTime - clip.startTime);
      const tf = evaluateClipTransformAtTime(clip, localTime);

      // Compute transitions
      let transOpacity = 1;
      let transOffsetX = 0;
      let transOffsetY = 0;
      let transScale = 1;
      let clipWipe: { edge: 'left' | 'right' | 'top'; ratio: number } | undefined;
      let irisRadius: number | undefined;
      let dipColor: { color: string; alpha: number } | undefined;
      let glitchOffset = 0;

      if (clip.transitionIn.type !== 'none' && clip.transitionIn.duration > 0 && localTime < clip.transitionIn.duration) {
        const p = localTime / clip.transitionIn.duration;
        const st = computeTransitionState(clip.transitionIn.type, p, 'in');
        transOpacity *= st.opacity;
        transOffsetX += st.offsetX;
        transOffsetY += st.offsetY;
        transScale *= st.scale;
        clipWipe = st.clipWipe;
        irisRadius = st.irisRadius;
        dipColor = st.dipColor;
        glitchOffset = st.glitchOffset ?? 0;
      }

      const remaining = clip.duration - localTime;
      if (clip.transitionOut.type !== 'none' && clip.transitionOut.duration > 0 && remaining < clip.transitionOut.duration) {
        const p = 1 - remaining / clip.transitionOut.duration;
        const st = computeTransitionState(clip.transitionOut.type, p, 'out');
        transOpacity *= st.opacity;
        transOffsetX += st.offsetX;
        transOffsetY += st.offsetY;
        transScale *= st.scale;
        if (st.clipWipe) clipWipe = st.clipWipe;
        if (st.irisRadius !== undefined) irisRadius = st.irisRadius;
        if (st.dipColor) dipColor = st.dipColor;
        if (st.glitchOffset) glitchOffset = st.glitchOffset;
      }

      // Subtle Ken Burns motion for cinema image plates unless frozen
      let kbScale = 1;
      let kbPanX = 0;
      if (!clip.freezeFrame && (clip.type === 'image' || clip.type === 'video')) {
        const ratio = clip.duration > 0 ? localTime / clip.duration : 0;
        const dir = clip.reversed ? 1 - ratio : ratio;
        if (clip.motionPreset === 'ken-burns-in') {
          kbScale = 1 + dir * 0.065;
        } else if (clip.motionPreset === 'ken-burns-pan') {
          kbScale = 1.06;
          kbPanX = (dir - 0.5) * w * 0.045;
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = clip.blendMode;
      ctx.globalAlpha = Math.max(0, Math.min(1, tf.opacity * transOpacity));

      // Apply transition clipping masks (Wipe / Iris)
      if (clipWipe) {
        ctx.beginPath();
        if (clipWipe.edge === 'left') {
          ctx.rect(0, 0, w * clipWipe.ratio, h);
        } else if (clipWipe.edge === 'right') {
          ctx.rect(w * (1 - clipWipe.ratio), 0, w * clipWipe.ratio, h);
        } else {
          ctx.rect(0, h * (1 - clipWipe.ratio), w, h * clipWipe.ratio);
        }
        ctx.clip();
      } else if (irisRadius !== undefined) {
        ctx.beginPath();
        const maxR = Math.hypot(w, h) * 0.6;
        ctx.arc(w / 2, h / 2, Math.max(1, maxR * irisRadius), 0, Math.PI * 2);
        ctx.clip();
      }

      // Apply user clip Mask
      if (clip.mask.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(
          w / 2,
          h / 2,
          (w * 0.45) * clip.mask.scale,
          (h * 0.45) * clip.mask.scale,
          0,
          0,
          Math.PI * 2
        );
        ctx.clip();
      } else if (clip.mask.shape === 'rectangle') {
        const mw = w * 0.82 * clip.mask.scale;
        const mh = h * 0.82 * clip.mask.scale;
        ctx.beginPath();
        ctx.rect((w - mw) / 2, (h - mh) / 2, mw, mh);
        ctx.clip();
      }

      // Apply clip transform
      const scaleFactor = w / 1280;
      ctx.translate(
        w / 2 + tf.x * scaleFactor + (transOffsetX / 100) * w + kbPanX,
        h / 2 + tf.y * scaleFactor + (transOffsetY / 100) * h
      );
      ctx.rotate((tf.rotation * Math.PI) / 180);
      ctx.scale(
        tf.scale * transScale * kbScale * (clip.transform.flipH ? -1 : 1),
        tf.scale * transScale * kbScale * (clip.transform.flipV ? -1 : 1)
      );
      ctx.translate(-w / 2, -h / 2);

      if (clip.type === 'title') {
        drawTitleClip(ctx, clip, w, h, localTime);
      } else if (clip.type === 'overlay' && clip.overlayType) {
        drawProceduralOverlay(ctx, clip.overlayType, w, h, currentTime);
      } else {
        const asset = assetsById.get(clip.assetId);
        const mediaEl = asset ? ensureAssetLoaded(asset, cache, onMediaReady) : null;

        if (mediaEl) {
          // Sync HTMLVideoElement smoothly with hardware acceleration
          if (mediaEl instanceof HTMLVideoElement) {
            const rawTarget = clip.freezeFrame
              ? clip.mediaOffset
              : clip.reversed
              ? Math.max(0, clip.sourceDuration - (clip.mediaOffset + localTime * clip.speed))
              : clip.mediaOffset + localTime * clip.speed;
            const targetTime = Math.max(0, Math.min(mediaEl.duration || clip.sourceDuration, rawTarget));

            if (options.isPlaying && !clip.freezeFrame && !clip.reversed) {
              mediaEl.playbackRate = Math.max(0.25, Math.min(4, clip.speed));
              if (mediaEl.paused) {
                mediaEl.play().catch(() => {});
              }
              if (Math.abs(mediaEl.currentTime - targetTime) > 0.28) {
                try {
                  mediaEl.currentTime = targetTime;
                } catch {
                  // ignore
                }
              }
            } else {
              if (!mediaEl.paused) {
                mediaEl.pause();
              }
              if (Math.abs(mediaEl.currentTime - targetTime) > 0.04) {
                try {
                  mediaEl.currentTime = targetTime;
                } catch {
                  // Ignore seek error while video metadata is still initializing
                }
              }
            }
          }

          const srcW =
            mediaEl instanceof HTMLVideoElement ? mediaEl.videoWidth : mediaEl.naturalWidth;
          const srcH =
            mediaEl instanceof HTMLVideoElement ? mediaEl.videoHeight : mediaEl.naturalHeight;

          if (srcW > 0 && srcH > 0) {
            // Apply crop percentages on source rect
            const sx = (clip.crop.left / 100) * srcW;
            const sy = (clip.crop.top / 100) * srcH;
            const sw = Math.max(1, srcW * (1 - (clip.crop.left + clip.crop.right) / 100));
            const sh = Math.max(1, srcH * (1 - (clip.crop.top + clip.crop.bottom) / 100));

            // Cover fit inside canvas
            const srcAspect = sw / sh;
            const dstAspect = w / h;
            let drawW = w;
            let drawH = h;
            let drawX = 0;
            let drawY = 0;
            if (srcAspect > dstAspect) {
              drawH = h;
              drawW = h * srcAspect;
              drawX = (w - drawW) / 2;
            } else {
              drawW = w;
              drawH = w / srcAspect;
              drawY = (h - drawH) / 2;
            }

            const { grade, preset } = getEffectiveColorGrade(
              clip.colorGrade,
              clip.filterPresetId,
              clip.filterIntensity
            );

            const applyPixelFX = !options.bypassGrade && needsPixelProcessing(clip);

            if (applyPixelFX) {
              // Render to scratch canvas at moderate internal resolution for smooth 30-60fps grading
              const procW = Math.min(w, project.settings.proxyMode ? 480 : 720);
              const procH = Math.max(1, Math.round((procW * h) / w));
              const scratch = getScratchCanvas(procW, procH);
              const sCtx = scratch.getContext('2d', { willReadFrequently: true });
              if (sCtx) {
                sCtx.clearRect(0, 0, procW, procH);
                if (grade.blur > 0) {
                  sCtx.filter = `blur(${(grade.blur * procW) / 1280}px)`;
                } else {
                  sCtx.filter = 'none';
                }
                const ratioX = procW / w;
                const ratioY = procH / h;
                sCtx.drawImage(
                  mediaEl,
                  sx,
                  sy,
                  sw,
                  sh,
                  drawX * ratioX,
                  drawY * ratioY,
                  drawW * ratioX,
                  drawH * ratioY
                );
                sCtx.filter = 'none';
                const imgData = sCtx.getImageData(0, 0, procW, procH);
                applyColorPipelineToPixels(
                  imgData.data,
                  grade,
                  clip.chromaKey,
                  preset?.tintOverlay,
                  clip.filterIntensity
                );
                sCtx.putImageData(imgData, 0, 0);
                ctx.drawImage(scratch, 0, 0, w, h);
              }
            } else {
              if (clip.colorGrade.blur > 0 && !options.bypassGrade) {
                ctx.filter = `blur(${clip.colorGrade.blur}px)`;
              }
              ctx.drawImage(mediaEl, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
              ctx.filter = 'none';
            }

            // Glitch transition horizontal RGB split accent
            if (glitchOffset > 1) {
              ctx.save();
              ctx.globalAlpha = 0.35;
              ctx.globalCompositeOperation = 'screen';
              ctx.drawImage(mediaEl, sx, sy, sw, sh, drawX + glitchOffset, drawY, drawW, drawH);
              ctx.drawImage(mediaEl, sx, sy, sw, sh, drawX - glitchOffset, drawY, drawW, drawH);
              ctx.restore();
            }

            // Preset grain / scanlines / vignette
            if (!options.bypassGrade) {
              if (preset?.grain && preset.grain * clip.filterIntensity > 0.02) {
                drawProceduralOverlay(ctx, 'film-grain', w, h, currentTime);
              }
              if (preset?.scanlines && clip.filterIntensity > 0.25) {
                drawProceduralOverlay(ctx, 'scanlines', w, h, currentTime);
              }
              const vignetteAmt = grade.vignette / 100;
              if (vignetteAmt > 0.01 || clip.mask.shape === 'vignette') {
                const vigStrength = Math.max(vignetteAmt, clip.mask.shape === 'vignette' ? 0.65 : 0);
                const grad = ctx.createRadialGradient(
                  w / 2,
                  h / 2,
                  Math.min(w, h) * 0.28,
                  w / 2,
                  h / 2,
                  Math.hypot(w, h) * 0.56
                );
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, vigStrength)})`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
              }
            }
          }
        } else {
          // Graceful styled cinema fallback while image asset loads
          const grad = ctx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#1e1b2e');
          grad.addColorStop(1, '#0f0d1a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // Dip-to-color transition overlay
      if (dipColor && dipColor.alpha > 0.02) {
        ctx.fillStyle = dipColor.color;
        ctx.globalAlpha = Math.min(1, dipColor.alpha);
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
    }
  }

  // Render active Captions / Subtitles
  if (project.showCaptions) {
    const activeCaption = project.captions.find(
      (cap) => currentTime >= cap.startTime && currentTime <= cap.endTime
    );
    if (activeCaption) {
      ctx.save();
      const fontSize = Math.max(15, Math.round(w * 0.024));
      ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText(activeCaption.text).width;
      const padX = fontSize * 0.9;
      const padY = fontSize * 0.45;
      const boxW = Math.min(w * 0.9, textWidth + padX * 2);
      const boxH = fontSize + padY * 2;
      const yPos = h - boxH - h * 0.05;

      ctx.fillStyle = 'rgba(10, 9, 15, 0.78)';
      ctx.beginPath();
      ctx.roundRect((w - boxW) / 2, yPos, boxW, boxH, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(activeCaption.text, w / 2, yPos + boxH / 2);
      ctx.restore();
    }
  }

  // Optional Title/Action Safe Guides
  if (options.showSafeGuides) {
    ctx.save();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
    // Center crosshair
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, h / 2);
    ctx.lineTo(w / 2 + 12, h / 2);
    ctx.moveTo(w / 2, h / 2 - 12);
    ctx.lineTo(w / 2, h / 2 + 12);
    ctx.stroke();
    ctx.restore();
  }
}
