import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditor } from '../../store/editorContext';
import { renderEngine } from '../../engine/renderEngine';
import { Clip } from '../../types/editor';

export const CanvasPreview: React.FC = () => {
  const {
    aspectRatio,
    clips,
    currentTime,
    selectedClip,
    updateClip,
    videoElements,
  } = useEditor();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dragging / Transform State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialClipX: number; initialClipY: number } | null>(null);

  // Determine Aspect Ratio Dimensions for container
  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case '9:16':
        return 'aspect-[9/16] max-h-[82vh] max-w-[46vh]';
      case '1:1':
        return 'aspect-square max-h-[75vh] max-w-[75vh]';
      case '4:5':
        return 'aspect-[4/5] max-h-[78vh] max-w-[62vh]';
      case '21:9':
        return 'aspect-[21/9] max-h-[60vh] max-w-[95%]';
      case '16:9':
      default:
        return 'aspect-video max-h-[78vh] max-w-[95%]';
    }
  };

  // Main Render Loop for Canvas Preview
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Clear background
    ctx.fillStyle = '#07050d';
    ctx.fillRect(0, 0, width, height);

    // 2. Filter active clips at currentTime
    const activeClips = clips
      .filter((c) => c.startTime <= currentTime && c.startTime + c.duration >= currentTime)
      .sort((a, b) => {
        // Render order: Main video first, overlays second, text & stickers last
        const typePriority: Record<string, number> = {
          video: 1,
          image: 2,
          effect: 3,
          sticker: 4,
          text: 5,
          audio: 0,
        };
        return (typePriority[a.type] || 0) - (typePriority[b.type] || 0);
      });

    // 3. Draw each clip
    for (const clip of activeClips) {
      if (clip.type === 'audio') continue;

      const clipLocalTime = currentTime - clip.startTime;
      const transform = renderEngine.interpolateKeyframes(clip, clipLocalTime);

      ctx.save();
      ctx.globalAlpha = transform.opacity;

      if (clip.type === 'video' || clip.type === 'image') {
        const videoEl = videoElements.current.get(clip.id);
        if (videoEl && videoEl.readyState >= 2) {
          // Sync video time
          const targetVideoTime = clip.sourceStartTime + clipLocalTime * clip.speed;
          if (Math.abs(videoEl.currentTime - targetVideoTime) > 0.08) {
            videoEl.currentTime = targetVideoTime;
          }

          ctx.filter = renderEngine.buildFilterString(clip.colorAdjustments, clip.filterId);

          const drawW = width * transform.scale;
          const drawH = height * transform.scale;

          ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
          ctx.rotate((transform.rotation * Math.PI) / 180);
          ctx.drawImage(videoEl, -drawW / 2, -drawH / 2, drawW, drawH);

          // Chroma Key
          if (clip.chromaKey?.enabled) {
            renderEngine.applyChromaKey(ctx, width, height, clip.chromaKey);
          }
        } else if (clip.type === 'image') {
          // Fallback image rendering
          const img = new Image();
          img.src = clip.sourceUrl;
          if (img.complete) {
            const drawW = width * transform.scale;
            const drawH = height * transform.scale;
            ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
            ctx.rotate((transform.rotation * Math.PI) / 180);
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          }
        }
      } else if (clip.type === 'text') {
        renderEngine.renderTextClip(ctx, clip, width, height, clipLocalTime);
      } else if (clip.type === 'sticker') {
        ctx.font = `${Math.floor(70 * transform.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(clip.text || '✨', width / 2 + transform.x, height / 2 + transform.y);
      }

      // Vignette effect
      if (clip.colorAdjustments?.vignette > 0) {
        renderEngine.drawVignette(ctx, width, height, clip.colorAdjustments.vignette);
      }

      // Glitch effect
      if (clip.effectId === 'effect-glitch-rgb') {
        renderEngine.drawGlitchEffect(ctx, width, height, currentTime);
      } else if (clip.effectId === 'effect-vhs-scanlines') {
        renderEngine.drawVhsEffect(ctx, width, height);
      }

      ctx.restore();
    }

    // 4. Draw Selected Clip Bounding Box & Handles
    if (selectedClip && selectedClip.type !== 'audio') {
      const active = activeClips.find((c) => c.id === selectedClip.id);
      if (active) {
        const clipLocalTime = currentTime - selectedClip.startTime;
        const transform = renderEngine.interpolateKeyframes(selectedClip, clipLocalTime);
        const centerX = width / 2 + transform.x;
        const centerY = height / 2 + transform.y;
        const boxW = Math.max(80, (width * 0.7) * transform.scale);
        const boxH = Math.max(50, (height * 0.7) * transform.scale);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

        // Corner Handles
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        const handles = [
          [-boxW / 2, -boxH / 2],
          [boxW / 2, -boxH / 2],
          [boxW / 2, boxH / 2],
          [-boxW / 2, boxH / 2],
        ];
        handles.forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.arc(hx, hy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        ctx.restore();
      }
    }
  }, [clips, currentTime, selectedClip, videoElements]);

  useEffect(() => {
    let animId: number;
    const tick = () => {
      renderFrame();
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [renderFrame]);

  // Handle Interactive Mouse Drag on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedClip || selectedClip.type === 'audio') return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialClipX: selectedClip.x,
      initialClipY: selectedClip.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || !selectedClip) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    updateClip(selectedClip.id, {
      x: Math.round(dragStart.initialClipX + deltaX),
      y: Math.round(dragStart.initialClipY + deltaY),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center bg-[var(--bg-main)] p-3 overflow-hidden select-none"
    >
      {/* Hidden Videos Elements Cache */}
      <div className="hidden">
        {clips
          .filter((c) => c.type === 'video')
          .map((c: Clip) => (
            <video
              key={c.id}
              ref={(el) => {
                if (el) {
                  videoElements.current.set(c.id, el);
                } else {
                  videoElements.current.delete(c.id);
                }
              }}
              src={c.sourceUrl}
              crossOrigin="anonymous"
              playsInline
              muted
              preload="auto"
            />
          ))}
      </div>

      {/* Responsive Canvas Frame */}
      <div
        className={`relative ${getAspectRatioClasses()} rounded-xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-black flex items-center justify-center transition-all duration-200`}
      >
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-full object-contain cursor-crosshair"
        />

        {/* Empty Canvas Placeholder Guide */}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
              ✨
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Timeline is Empty</h3>
            <p className="text-xs text-gray-400 max-w-xs">
              Click <b>Media</b> on the left to add video clips, or use our sample clips to start editing!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
