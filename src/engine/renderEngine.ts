import { Clip, Keyframe, ColorAdjustments, ChromaKeySettings } from '../types/editor';
import { FILTER_PRESETS } from './presets';

export class RenderEngine {
  // Interpolate keyframe values at a given clip time
  interpolateKeyframes(clip: Clip, clipLocalTime: number): {
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
  } {
    if (!clip.keyframes || clip.keyframes.length === 0) {
      return {
        x: clip.x,
        y: clip.y,
        scale: clip.scale,
        rotation: clip.rotation,
        opacity: clip.opacity,
      };
    }

    const sorted = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset);
    if (clipLocalTime <= sorted[0].timeOffset) {
      return {
        x: sorted[0].x,
        y: sorted[0].y,
        scale: sorted[0].scale,
        rotation: sorted[0].rotation,
        opacity: sorted[0].opacity,
      };
    }
    if (clipLocalTime >= sorted[sorted.length - 1].timeOffset) {
      const last = sorted[sorted.length - 1];
      return {
        x: last.x,
        y: last.y,
        scale: last.scale,
        rotation: last.rotation,
        opacity: last.opacity,
      };
    }

    // Find surrounding keyframes
    let k1: Keyframe = sorted[0];
    let k2: Keyframe = sorted[1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (clipLocalTime >= sorted[i].timeOffset && clipLocalTime <= sorted[i + 1].timeOffset) {
        k1 = sorted[i];
        k2 = sorted[i + 1];
        break;
      }
    }

    const t = (clipLocalTime - k1.timeOffset) / (k2.timeOffset - k1.timeOffset);
    // Smooth ease-in-out curve
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    return {
      x: k1.x + (k2.x - k1.x) * ease,
      y: k1.y + (k2.y - k1.y) * ease,
      scale: k1.scale + (k2.scale - k1.scale) * ease,
      rotation: k1.rotation + (k2.rotation - k1.rotation) * ease,
      opacity: k1.opacity + (k2.opacity - k1.opacity) * ease,
    };
  }

  // Generate CSS filter string from color adjustments and active filter preset
  buildFilterString(adjustments: ColorAdjustments, filterId?: string): string {
    let brightness = 100 + adjustments.brightness;
    let contrast = 100 + adjustments.contrast;
    let saturate = 100 + adjustments.saturation;
    let hue = adjustments.hue;
    let blur = adjustments.blur;

    if (filterId) {
      const preset = FILTER_PRESETS.find((f) => f.id === filterId);
      if (preset && preset.adjustments) {
        if (preset.adjustments.brightness) brightness += preset.adjustments.brightness;
        if (preset.adjustments.contrast) contrast += preset.adjustments.contrast;
        if (preset.adjustments.saturation) saturate += preset.adjustments.saturation;
        if (preset.adjustments.hue) hue += preset.adjustments.hue;
      }
    }

    return `brightness(${Math.max(0, brightness)}%) contrast(${Math.max(0, contrast)}%) saturate(${Math.max(0, saturate)}%) hue-rotate(${hue}deg) blur(${blur}px)`;
  }

  // Chroma key green-screen removal on an image or video canvas context
  applyChromaKey(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    chroma: ChromaKeySettings
  ) {
    if (!chroma.enabled) return;

    try {
      const frame = ctx.getImageData(0, 0, width, height);
      const l = frame.data.length / 4;
      const targetR = parseInt(chroma.color.slice(1, 3), 16);
      const targetG = parseInt(chroma.color.slice(3, 5), 16);
      const targetB = parseInt(chroma.color.slice(5, 7), 16);

      const tolerance = (chroma.similarity / 100) * 255;
      const softness = (chroma.smoothness / 100) * 100;

      for (let i = 0; i < l; i++) {
        const r = frame.data[i * 4 + 0];
        const g = frame.data[i * 4 + 1];
        const b = frame.data[i * 4 + 2];

        const dist = Math.sqrt(
          (r - targetR) * (r - targetR) +
          (g - targetG) * (g - targetG) +
          (b - targetB) * (b - targetB)
        );

        if (dist < tolerance) {
          frame.data[i * 4 + 3] = 0; // Transparent
        } else if (dist < tolerance + softness) {
          const alphaFactor = (dist - tolerance) / softness;
          frame.data[i * 4 + 3] = Math.floor(frame.data[i * 4 + 3] * alphaFactor);
        }
      }

      ctx.putImageData(frame, 0, 0);
    } catch {
      // Cross-origin restriction fallback
    }
  }

  // Draw Vignette overlay
  drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number) {
    if (strength <= 0) return;
    const radius = Math.max(width, height) * 0.75;
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, radius * 0.4,
      width / 2, height / 2, radius
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${strength / 100})`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Draw RGB Split / Glitch effect
  drawGlitchEffect(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
    const shift = Math.sin(time * 20) * 8;
    if (Math.abs(shift) > 4) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 0, 80, 0.2)';
      ctx.fillRect(shift, 0, width, height);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.fillRect(-shift, 0, width, height);
      ctx.restore();
    }
  }

  // Draw VHS scanlines effect
  drawVhsEffect(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y, width, 1.5);
    }
    ctx.restore();
  }

  // Render stylized text layer with animations & glow
  renderTextClip(
    ctx: CanvasRenderingContext2D,
    clip: Clip,
    canvasWidth: number,
    canvasHeight: number,
    clipLocalTime: number
  ) {
    const text = clip.text || 'Z-EDITZ';
    const fontSize = (clip.fontSize || 54) * (canvasHeight / 720);
    const fontFamily = clip.fontFamily || 'Impact, sans-serif';
    const textColor = clip.textColor || '#ffffff';
    const glowColor = clip.textGlowColor || '#a855f7';
    const outlineColor = clip.textOutlineColor || '#000000';
    const outlineWidth = clip.textOutlineWidth || 3;

    ctx.save();
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Handle Text Animations
    let displayedText = text;
    if (clip.textAnimation === 'typewriter') {
      const charsToShow = Math.floor((clipLocalTime / Math.max(0.5, clip.duration * 0.4)) * text.length);
      displayedText = text.slice(0, Math.min(text.length, Math.max(1, charsToShow)));
    }

    const posX = canvasWidth / 2 + clip.x;
    const posY = canvasHeight / 2 + clip.y;

    ctx.translate(posX, posY);
    ctx.rotate((clip.rotation * Math.PI) / 180);
    ctx.scale(clip.scale, clip.scale);

    // Text Background Box
    if (clip.textBgColor && clip.textBgColor !== 'transparent') {
      const metrics = ctx.measureText(displayedText);
      const padding = 14;
      ctx.fillStyle = clip.textBgColor;
      ctx.fillRect(
        -metrics.width / 2 - padding,
        -fontSize / 2 - padding / 2,
        metrics.width + padding * 2,
        fontSize + padding
      );
    }

    // Neon Glow
    if (glowColor && glowColor !== 'transparent') {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 18;
    }

    // Text Outline
    if (outlineWidth > 0 && outlineColor) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = outlineWidth * 2;
      ctx.strokeText(displayedText, 0, 0);
    }

    // Text Fill
    ctx.fillStyle = textColor;
    ctx.fillText(displayedText, 0, 0);

    ctx.restore();
  }
}

export const renderEngine = new RenderEngine();
