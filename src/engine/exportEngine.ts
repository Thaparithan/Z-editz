import { ExportSettings, Clip, AspectRatio } from '../types/editor';
import { renderEngine } from './renderEngine';

export class ExportEngine {
  private isCancelling: boolean = false;

  cancelExport() {
    this.isCancelling = true;
  }

  // Calculate resolution based on preset and aspect ratio
  getDimensions(resolution: ExportSettings['resolution'], aspect: AspectRatio): { width: number; height: number } {
    let baseWidth = 1920;
    let baseHeight = 1080;

    switch (resolution) {
      case '720p':
        baseWidth = 1280;
        baseHeight = 720;
        break;
      case '1080p':
        baseWidth = 1920;
        baseHeight = 1080;
        break;
      case '2k':
        baseWidth = 2560;
        baseHeight = 1440;
        break;
      case '4k':
        baseWidth = 3840;
        baseHeight = 2160;
        break;
    }

    if (aspect === '9:16') {
      return { width: baseHeight, height: baseWidth };
    } else if (aspect === '1:1') {
      return { width: baseHeight, height: baseHeight };
    } else if (aspect === '4:5') {
      return { width: Math.round(baseHeight * 0.8), height: baseHeight };
    } else if (aspect === '21:9') {
      return { width: Math.round(baseHeight * (21 / 9)), height: baseHeight };
    }

    return { width: baseWidth, height: baseHeight };
  }

  // Render and export the timeline
  async exportTimeline(
    clips: Clip[],
    totalDuration: number,
    aspect: AspectRatio,
    settings: ExportSettings,
    videoElements: Map<string, HTMLVideoElement>,
    onProgress: (percent: number) => void
  ): Promise<Blob> {
    this.isCancelling = false;
    const { width, height } = this.getDimensions(settings.resolution, aspect);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d', { willReadFrequently: true })!;

    const stream = exportCanvas.captureStream(settings.fps);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm; codecs=vp9';

    // Calculate bitrate based on quality and 4K settings
    let videoBitrate = 8_000_000;
    if (settings.resolution === '4k') {
      videoBitrate = settings.quality === 'ultra_pro' ? 45_000_000 : 25_000_000;
    } else if (settings.resolution === '2k') {
      videoBitrate = 18_000_000;
    } else if (settings.resolution === '1080p') {
      videoBitrate = 12_000_000;
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: videoBitrate,
    });

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(recordedChunks, { type: mimeType });
        resolve(finalBlob);
      };

      mediaRecorder.start(100);

      const frameInterval = 1 / settings.fps;
      let currentTime = 0;

      const renderStep = async () => {
        if (this.isCancelling) {
          mediaRecorder.stop();
          reject(new Error('Export cancelled by user'));
          return;
        }

        if (currentTime >= totalDuration) {
          mediaRecorder.stop();
          return;
        }

        // 1. Clear Frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // 2. Render all visible active clips at currentTime
        const activeClips = clips
          .filter((c) => c.startTime <= currentTime && c.startTime + c.duration >= currentTime)
          .sort((a, b) => (a.type === 'video' ? -1 : 1));

        for (const clip of activeClips) {
          const clipLocalTime = currentTime - clip.startTime;
          const transform = renderEngine.interpolateKeyframes(clip, clipLocalTime);

          ctx.save();
          ctx.globalAlpha = transform.opacity;

          if (clip.type === 'video' || clip.type === 'image') {
            const videoEl = videoElements.get(clip.id);
            if (videoEl) {
              videoEl.currentTime = clip.sourceStartTime + clipLocalTime * clip.speed;
              
              ctx.filter = renderEngine.buildFilterString(clip.colorAdjustments, clip.filterId);

              const drawW = width * transform.scale;
              const drawH = height * transform.scale;
              const drawX = (width - drawW) / 2 + transform.x;
              const drawY = (height - drawH) / 2 + transform.y;

              ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
              ctx.rotate((transform.rotation * Math.PI) / 180);
              ctx.drawImage(videoEl, -drawW / 2, -drawH / 2, drawW, drawH);

              // Chroma Key
              if (clip.chromaKey?.enabled) {
                renderEngine.applyChromaKey(ctx, width, height, clip.chromaKey);
              }
            }
          } else if (clip.type === 'text') {
            renderEngine.renderTextClip(ctx, clip, width, height, clipLocalTime);
          } else if (clip.type === 'sticker') {
            // Draw sticker emoji or shape
            ctx.font = `${Math.floor(80 * (height / 720) * transform.scale)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(clip.text || '✨', width / 2 + transform.x, height / 2 + transform.y);
          }

          // Vignette & Overlays
          if (clip.colorAdjustments?.vignette > 0) {
            renderEngine.drawVignette(ctx, width, height, clip.colorAdjustments.vignette);
          }

          ctx.restore();
        }

        currentTime += frameInterval;
        const progress = Math.min(100, Math.round((currentTime / totalDuration) * 100));
        onProgress(progress);

        // Next frame tick
        setTimeout(renderStep, Math.max(0, 1000 / settings.fps - 5));
      };

      renderStep();
    });
  }

  // Helper to trigger browser file download
  triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export const exportEngine = new ExportEngine();
