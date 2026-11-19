import type { CaptionItem, ProjectState } from '../types/editor';
import type { ZEditzAudioEngine } from './audioEngine';
import { createMediaCache, renderTimelineFrame } from './compositor';
import { getProjectDuration, serializeProject } from './timelineEngine';

export function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.floor((safe - Math.floor(safe)) * 1000);
  const p = (n: number, len = 2) => n.toString().padStart(len, '0');
  return `${p(hrs)}:${p(mins)}:${p(secs)},${p(ms, 3)}`;
}

export function generateSRT(captions: CaptionItem[]): string {
  const sorted = [...captions].sort((a, b) => a.startTime - b.startTime);
  return sorted
    .map(
      (cap, idx) =>
        `${idx + 1}\n${formatSrtTime(cap.startTime)} --> ${formatSrtTime(cap.endTime)}\n${cap.text}\n`
    )
    .join('\n');
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadProjectJson(project: ProjectState) {
  const json = serializeProject(project);
  const blob = new Blob([json], { type: 'application/json' });
  const safeName = project.settings.name.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  triggerBlobDownload(blob, `${safeName || 'z_editz_project'}.zeditz.json`);
}

export function downloadCaptionsSrt(captions: CaptionItem[], projectName: string) {
  const srt = generateSRT(captions);
  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
  const safeName = projectName.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  triggerBlobDownload(blob, `${safeName || 'captions'}.srt`);
}

export function exportCurrentFramePng(canvas: HTMLCanvasElement, projectName: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const safeName = projectName.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
    triggerBlobDownload(blob, `${safeName}_frame.png`);
  }, 'image/png');
}

export interface VideoRenderParams {
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  format: 'webm-vp9' | 'webm-vp8' | 'mp4-h264';
  audioEngine?: ZEditzAudioEngine | null;
  signal?: AbortSignal;
  onProgress: (pct: number) => void;
}

/**
 * Renders the timeline using an offscreen Canvas + real browser MediaRecorder.
 * Captures synchronized audio from ZEditzAudioEngine and accurate timeline duration.
 */
export async function renderProjectVideo(
  project: ProjectState,
  params: VideoRenderParams
): Promise<{ blob: Blob; url: string; mimeType: string }> {
  const duration = getProjectDuration(project.clips);
  const startT = project.settings.inPoint ?? 0;
  const endT = project.settings.outPoint ?? duration;
  const renderDuration = Math.max(0.5, endT - startT);

  // Cap export canvas size gracefully for browser memory safety while preserving exact aspect ratio
  const maxDim = Math.max(params.width, params.height);
  const scaleDown = maxDim > 1920 ? 1920 / maxDim : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(params.width * scaleDown);
  canvas.height = Math.round(params.height * scaleDown);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D rendering context for export.');
  }

  const cache = createMediaCache();

  // Preload image assets
  await Promise.all(
    project.assets
      .filter((a) => a.type === 'image' && a.src)
      .map(
        (a) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              cache.images.set(a.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = a.src!;
          })
      )
  );

  // Preload video assets
  await Promise.all(
    project.assets
      .filter((a) => a.type === 'video' && a.src)
      .map(
        (a) =>
          new Promise<void>((resolve) => {
            const vid = document.createElement('video');
            vid.crossOrigin = 'anonymous';
            vid.muted = true;
            vid.playsInline = true;
            vid.preload = 'auto';
            vid.onloadeddata = () => {
              cache.videos.set(a.id, vid);
              resolve();
            };
            vid.onerror = () => resolve();
            vid.src = a.src!;
          })
      )
  );

  const mimeCandidates =
    params.format === 'mp4-h264'
      ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm']
      : params.format === 'webm-vp9'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm'];

  const supportedMime =
    typeof MediaRecorder !== 'undefined'
      ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      : 'video/webm';

  const canvasStream = canvas.captureStream(Math.min(60, params.fps));
  const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

  const audioStream = params.audioEngine?.getExportAudioStream();
  if (audioStream) {
    const audioTracks = audioStream.getAudioTracks();
    if (audioTracks.length > 0) {
      combinedTracks.push(audioTracks[0]);
    }
  }

  const stream = new MediaStream(combinedTracks);
  const recorder = new MediaRecorder(stream, {
    mimeType: supportedMime,
    videoBitsPerSecond: params.videoBitrateKbps * 1000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  return new Promise((resolve, reject) => {
    let stopped = false;
    let rafId = 0;

    const cleanup = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      params.audioEngine?.stopPlayback();
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // ignore already stopped
        }
      }
    };

    if (params.signal) {
      params.signal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Render was cancelled.'));
      });
    }

    recorder.onerror = () => {
      cleanup();
      reject(new Error('MediaRecorder encountered an encoding error.'));
    };

    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: supportedMime });
      const url = URL.createObjectURL(blob);
      params.onProgress(100);
      resolve({ blob, url, mimeType: supportedMime });
    };

    // Prime initial frame
    renderTimelineFrame(ctx, project, startT, cache);

    // Start audio playback silently routed to export destination
    if (params.audioEngine) {
      params.audioEngine.startPlayback(project, startT, { muteSpeaker: true });
    }

    recorder.start(100);

    const startWallTime = performance.now();

    const tick = (now: number) => {
      if (stopped) return;
      const elapsedSec = (now - startWallTime) / 1000;
      const currentT = Math.min(endT, startT + elapsedSec);

      renderTimelineFrame(ctx, project, currentT, cache);
      params.audioEngine?.updateLiveMix(project, currentT);

      const pct = Math.min(99, Math.round((elapsedSec / renderDuration) * 100));
      params.onProgress(pct);

      if (elapsedSec < renderDuration) {
        rafId = requestAnimationFrame(tick);
      } else {
        setTimeout(cleanup, 120);
      }
    };

    rafId = requestAnimationFrame(tick);
  });
}
