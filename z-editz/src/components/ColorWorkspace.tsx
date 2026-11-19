import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import type {
  ColorGrade,
  ColorWheelValue,
  CurvePoint,
  ProjectState,
  TimelineClip,
} from '../types/editor';
import {
  FILTER_PRESETS,
  computeHistogram,
  createDefaultColorGrade,
  createDefaultCurve,
} from '../engine/colorPipeline';
import { generateColorGradeWithGemini } from '../engine/geminiService';
import type { MediaResourceCache } from '../engine/compositor';
import { PreviewMonitor } from './PreviewMonitor';

type ScopeMode = 'parade' | 'waveform' | 'histogram' | 'vectorscope';
type CurveChannel = 'master' | 'red' | 'green' | 'blue';

interface ColorWorkspaceProps {
  project: ProjectState;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  loopEnabled: boolean;
  playbackRate: number;
  selectedClip: TimelineClip | null;
  mediaCache: MediaResourceCache;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleLoop: () => void;
  onSetInPoint: () => void;
  onSetOutPoint: () => void;
  onToggleProxyMode: () => void;
  onExportFramePng: (canvas: HTMLCanvasElement) => void;
  onUpdateClip: (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => void;
}

export const ColorWorkspace: React.FC<ColorWorkspaceProps> = ({
  project,
  currentTime,
  duration,
  isPlaying,
  loopEnabled,
  playbackRate,
  selectedClip,
  mediaCache,
  onTogglePlay,
  onSeek,
  onToggleLoop,
  onSetInPoint,
  onSetOutPoint,
  onToggleProxyMode,
  onExportFramePng,
  onUpdateClip,
}) => {
  const [scopeMode, setScopeMode] = useState<ScopeMode>('parade');
  const [bypassGrade, setBypassGrade] = useState(false);
  const [curveChannel, setCurveChannel] = useState<CurveChannel>('master');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const scopeCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Choose active visual clip at playhead if none selected
  const activeClip =
    (selectedClip && selectedClip.type !== 'audio' ? selectedClip : null) ??
    project.clips.find(
      (c) =>
        c.type !== 'audio' &&
        c.type !== 'title' &&
        currentTime >= c.startTime &&
        currentTime < c.startTime + c.duration
    ) ??
    project.clips.find((c) => c.type === 'image' || c.type === 'video') ??
    null;

  const drawScopesFromCanvas = useCallback(
    (srcCanvas: HTMLCanvasElement | null) => {
      const scopeCanvas = scopeCanvasRef.current;
      if (!scopeCanvas || !srcCanvas) return;
      const sCtx = scopeCanvas.getContext('2d');
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (!sCtx || !srcCtx) return;

      const sw = scopeCanvas.width;
      const sh = scopeCanvas.height;
      sCtx.fillStyle = '#0a0910';
      sCtx.fillRect(0, 0, sw, sh);

      // Subtle IRE graticule lines (0, 25, 50, 75, 100%)
      sCtx.strokeStyle = 'rgba(161, 161, 170, 0.16)';
      sCtx.lineWidth = 1;
      for (let g = 1; g < 4; g++) {
        const y = (g / 4) * sh;
        sCtx.beginPath();
        sCtx.moveTo(0, y);
        sCtx.lineTo(sw, y);
        sCtx.stroke();
      }

      let imgData: ImageData;
      try {
        imgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      } catch {
        return;
      }

      const data = imgData.data;
      const srcW = srcCanvas.width;
      const srcH = srcCanvas.height;

      if (scopeMode === 'histogram') {
        const hist = computeHistogram(data);
        const channels: [Uint32Array, string][] = [
          [hist.histogramR, 'rgba(244, 63, 94, 0.65)'],
          [hist.histogramG, 'rgba(34, 197, 94, 0.65)'],
          [hist.histogramB, 'rgba(59, 130, 246, 0.7)'],
        ];
        for (const [bins, color] of channels) {
          sCtx.fillStyle = color;
          sCtx.beginPath();
          sCtx.moveTo(0, sh);
          for (let i = 0; i < 256; i++) {
            const x = (i / 255) * sw;
            const hRatio = Math.min(1, bins[i] / Math.max(1, hist.maxBin * 0.85));
            sCtx.lineTo(x, sh - hRatio * (sh - 12));
          }
          sCtx.lineTo(sw, sh);
          sCtx.closePath();
          sCtx.fill();
        }
      } else if (scopeMode === 'parade') {
        const thirdW = sw / 3;
        const stepX = Math.max(2, Math.floor(srcW / 96));
        const stepY = Math.max(2, Math.floor(srcH / 64));

        for (let y = 0; y < srcH; y += stepY) {
          for (let x = 0; x < srcW; x += stepX) {
            const idx = (y * srcW + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const nx = x / srcW;

            sCtx.fillStyle = 'rgba(248, 113, 113, 0.35)';
            sCtx.fillRect(nx * thirdW, sh - (r / 255) * sh, 1.5, 1.5);

            sCtx.fillStyle = 'rgba(74, 222, 128, 0.35)';
            sCtx.fillRect(thirdW + nx * thirdW, sh - (g / 255) * sh, 1.5, 1.5);

            sCtx.fillStyle = 'rgba(96, 165, 250, 0.38)';
            sCtx.fillRect(thirdW * 2 + nx * thirdW, sh - (b / 255) * sh, 1.5, 1.5);
          }
        }
      } else if (scopeMode === 'waveform') {
        const stepX = Math.max(2, Math.floor(srcW / 120));
        const stepY = Math.max(2, Math.floor(srcH / 72));
        sCtx.fillStyle = 'rgba(196, 181, 253, 0.36)';
        for (let y = 0; y < srcH; y += stepY) {
          for (let x = 0; x < srcW; x += stepX) {
            const idx = (y * srcW + x) * 4;
            const luma = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
            sCtx.fillRect((x / srcW) * sw, sh - (luma / 255) * sh, 1.6, 1.6);
          }
        }
      } else if (scopeMode === 'vectorscope') {
        const cx = sw / 2;
        const cy = sh / 2;
        const radius = Math.min(sw, sh) * 0.44;
        sCtx.strokeStyle = 'rgba(161, 161, 170, 0.24)';
        sCtx.beginPath();
        sCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        sCtx.stroke();
        sCtx.beginPath();
        sCtx.moveTo(cx - radius, cy);
        sCtx.lineTo(cx + radius, cy);
        sCtx.moveTo(cx, cy - radius);
        sCtx.lineTo(cx, cy + radius);
        sCtx.stroke();

        const stepX = Math.max(3, Math.floor(srcW / 80));
        const stepY = Math.max(3, Math.floor(srcH / 60));
        for (let y = 0; y < srcH; y += stepY) {
          for (let x = 0; x < srcW; x += stepX) {
            const idx = (y * srcW + x) * 4;
            const r = data[idx] / 255;
            const g = data[idx + 1] / 255;
            const b = data[idx + 2] / 255;
            // Cb / Cr projection
            const cb = -0.1687 * r - 0.3313 * g + 0.5 * b;
            const cr = 0.5 * r - 0.4187 * g - 0.0813 * b;
            sCtx.fillStyle = `rgba(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]}, 0.5)`;
            sCtx.fillRect(cx + cb * radius * 1.9, cy - cr * radius * 1.9, 2, 2);
          }
        }
      }
    },
    [scopeMode]
  );

  const handleFrameRendered = useCallback(
    (canvas: HTMLCanvasElement) => {
      lastPreviewCanvasRef.current = canvas;
      drawScopesFromCanvas(canvas);
    },
    [drawScopesFromCanvas]
  );

  useEffect(() => {
    if (lastPreviewCanvasRef.current) {
      drawScopesFromCanvas(lastPreviewCanvasRef.current);
    }
  }, [scopeMode, drawScopesFromCanvas]);

  const updateGrade = (patch: Partial<ColorGrade>) => {
    if (!activeClip) return;
    onUpdateClip(activeClip.id, (c) => ({
      ...c,
      colorGrade: { ...c.colorGrade, ...patch },
    }));
  };

  const updateWheel = (wheel: 'lift' | 'gamma' | 'gain', next: ColorWheelValue) => {
    if (!activeClip) return;
    onUpdateClip(activeClip.id, (c) => ({
      ...c,
      colorGrade: {
        ...c.colorGrade,
        wheels: {
          ...c.colorGrade.wheels,
          [wheel]: next,
        },
      },
    }));
  };

  const updateCurvePoints = (points: CurvePoint[]) => {
    if (!activeClip) return;
    onUpdateClip(activeClip.id, (c) => ({
      ...c,
      colorGrade: {
        ...c.colorGrade,
        curves: {
          ...c.colorGrade.curves,
          [curveChannel]: points,
        },
      },
    }));
  };

  const handleApplyAiGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || !activeClip) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const generatedGrade = await generateColorGradeWithGemini(aiPrompt.trim());
      onUpdateClip(activeClip.id, (c) => ({
        ...c,
        filterPresetId: 'none',
        colorGrade: {
          ...c.colorGrade,
          ...generatedGrade,
          wheels: {
            ...c.colorGrade.wheels,
            ...(generatedGrade.wheels || {}),
          },
        },
      }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI grading failed.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#f5f4f9] dark:bg-[#0d0c13] overflow-hidden">
      {/* Top Row: Monitor + Live Scopes */}
      <div className="flex-1 min-h-[260px] grid grid-cols-1 lg:grid-cols-12 border-b border-[#e4e1ee] dark:border-[#242233] overflow-hidden">
        <div className="lg:col-span-8 min-h-0 flex flex-col border-r border-[#e4e1ee] dark:border-[#242233]">
          <PreviewMonitor
            project={project}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            loopEnabled={loopEnabled}
            playbackRate={playbackRate}
            selectedClip={activeClip}
            mediaCache={mediaCache}
            bypassGrade={bypassGrade}
            onTogglePlay={onTogglePlay}
            onSeek={onSeek}
            onToggleLoop={onToggleLoop}
            onSetInPoint={onSetInPoint}
            onSetOutPoint={onSetOutPoint}
            onToggleProxyMode={onToggleProxyMode}
            onExportFramePng={onExportFramePng}
            onCanvasFrameRendered={handleFrameRendered}
          />
        </div>

        {/* Live Video Scopes Panel */}
        <div className="lg:col-span-4 flex flex-col bg-white dark:bg-[#13121a] min-h-0">
          <div className="h-9 px-3 flex items-center justify-between border-b border-[#e4e1ee] dark:border-[#242233] shrink-0">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Video Scopes
            </span>
            <div className="flex items-center gap-1">
              {(['parade', 'waveform', 'histogram', 'vectorscope'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setScopeMode(m)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded capitalize transition-colors ${
                    scopeMode === m
                      ? 'bg-violet-700 text-white dark:bg-violet-600'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-white/5'
                  }`}
                >
                  {m === 'vectorscope' ? 'Vector' : m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-3 flex flex-col gap-2.5 min-h-0">
            <canvas
              ref={scopeCanvasRef}
              width={420}
              height={220}
              data-testid="color-scope-canvas"
              className="w-full flex-1 min-h-[150px] rounded-md bg-[#0a0910] border border-zinc-800"
            />
            <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
              <span>Target: {activeClip ? activeClip.name : 'No visual clip'}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBypassGrade((v) => !v)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    bypassGrade
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-100 dark:bg-[#1e1c2b] text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {bypassGrade ? 'Bypassed (Original)' : 'Bypass Grade'}
                </button>
                {activeClip && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateClip(activeClip.id, (c) => ({
                        ...c,
                        filterPresetId: 'none',
                        colorGrade: createDefaultColorGrade(),
                      }))
                    }
                    aria-label="Reset color grade"
                    className="p-1 rounded text-zinc-500 hover:text-violet-600 dark:hover:text-violet-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gemini AI Colorist Banner */}
      <div className="px-4 py-2 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 border-b border-[#e4e1ee] dark:border-[#242233] flex items-center justify-between gap-3 flex-wrap">
        <form onSubmit={handleApplyAiGrade} className="flex-1 flex items-center gap-2 max-w-2xl">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI Colorist:</span>
          </div>
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. 90s warm cinematic Kodak film, moody cyberpunk neon, golden hour sunset..."
            className="flex-1 min-w-[200px] px-2.5 py-1 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={aiLoading || !activeClip || !aiPrompt.trim()}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white flex items-center gap-1.5 shrink-0"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            <span>{aiLoading ? 'Grading...' : 'Grade with AI'}</span>
          </button>
        </form>
        {aiError && <span className="text-[11px] text-rose-500 truncate max-w-sm">{aiError}</span>}
      </div>

      {/* Bottom Console: Wheels, Primary Sliders, RGB Curves & LUT Presets */}
      <div className="h-[290px] shrink-0 grid grid-cols-1 md:grid-cols-12 bg-white dark:bg-[#13121a] overflow-y-auto">
        {/* 3 Color Wheels (Lift / Gamma / Gain) */}
        <div className="md:col-span-5 p-3.5 border-r border-[#e4e1ee] dark:border-[#242233] flex flex-col justify-start gap-3">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Color Wheels · Lift / Gamma / Gain
          </div>
          {activeClip ? (
            <div className="grid grid-cols-3 gap-3 items-start pt-1">
              {(['lift', 'gamma', 'gain'] as const).map((key) => (
                <ColorWheelControl
                  key={key}
                  label={key[0].toUpperCase() + key.slice(1)}
                  value={activeClip.colorGrade.wheels[key]}
                  onChange={(val) => updateWheel(key, val)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Select a clip to grade color wheels.</p>
          )}
        </div>

        {/* Primary Sliders */}
        <div className="md:col-span-4 p-3.5 border-r border-[#e4e1ee] dark:border-[#242233] space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Primary Correction
          </div>
          {activeClip && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              <GradeSlider
                label="Exposure"
                value={activeClip.colorGrade.exposure}
                display={`${activeClip.colorGrade.exposure > 0 ? '+' : ''}${activeClip.colorGrade.exposure.toFixed(2)} EV`}
                min={-1.5}
                max={1.5}
                step={0.05}
                onChange={(v) => updateGrade({ exposure: v })}
              />
              <GradeSlider
                label="Contrast"
                value={activeClip.colorGrade.contrast}
                display={`${Math.round(activeClip.colorGrade.contrast)}`}
                min={-80}
                max={80}
                step={1}
                onChange={(v) => updateGrade({ contrast: v })}
              />
              <GradeSlider
                label="Saturation"
                value={activeClip.colorGrade.saturation}
                display={`${Math.round(activeClip.colorGrade.saturation)}`}
                min={-100}
                max={100}
                step={1}
                onChange={(v) => updateGrade({ saturation: v })}
              />
              <GradeSlider
                label="Temperature"
                value={activeClip.colorGrade.temperature}
                display={`${Math.round(activeClip.colorGrade.temperature)}`}
                min={-80}
                max={80}
                step={1}
                onChange={(v) => updateGrade({ temperature: v })}
              />
              <GradeSlider
                label="Tint"
                value={activeClip.colorGrade.tint}
                display={`${Math.round(activeClip.colorGrade.tint)}`}
                min={-80}
                max={80}
                step={1}
                onChange={(v) => updateGrade({ tint: v })}
              />
              <GradeSlider
                label="Gamma"
                value={activeClip.colorGrade.gamma}
                display={activeClip.colorGrade.gamma.toFixed(2)}
                min={0.5}
                max={1.8}
                step={0.02}
                onChange={(v) => updateGrade({ gamma: v })}
              />
              <GradeSlider
                label="Shadows"
                value={activeClip.colorGrade.shadows}
                display={`${Math.round(activeClip.colorGrade.shadows)}`}
                min={-60}
                max={60}
                step={1}
                onChange={(v) => updateGrade({ shadows: v })}
              />
              <GradeSlider
                label="Highlights"
                value={activeClip.colorGrade.highlights}
                display={`${Math.round(activeClip.colorGrade.highlights)}`}
                min={-60}
                max={60}
                step={1}
                onChange={(v) => updateGrade({ highlights: v })}
              />
              <GradeSlider
                label="Vignette"
                value={activeClip.colorGrade.vignette}
                display={`${Math.round(activeClip.colorGrade.vignette)}%`}
                min={0}
                max={100}
                step={1}
                onChange={(v) => updateGrade({ vignette: v })}
              />
              <div className="space-y-1">
                <span className="text-zinc-600 dark:text-zinc-400 block">LUT / Look</span>
                <select
                  aria-label="Color preset LUT"
                  value={activeClip.filterPresetId}
                  onChange={(e) =>
                    onUpdateClip(activeClip.id, (c) => ({
                      ...c,
                      filterPresetId: e.target.value,
                    }))
                  }
                  className="w-full px-1.5 py-1 text-[11px] rounded bg-[#f8f7fb] dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100"
                >
                  {FILTER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Interactive RGB Curves */}
        <div className="md:col-span-3 p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              RGB Curves
            </span>
            <div className="flex items-center gap-1">
              {(['master', 'red', 'green', 'blue'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setCurveChannel(ch)}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase ${
                    curveChannel === ch
                      ? ch === 'red'
                        ? 'bg-rose-600 text-white'
                        : ch === 'green'
                        ? 'bg-emerald-600 text-white'
                        : ch === 'blue'
                        ? 'bg-blue-600 text-white'
                        : 'bg-violet-600 text-white'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {ch === 'master' ? 'Y' : ch[0]}
                </button>
              ))}
              {activeClip && (
                <button
                  type="button"
                  onClick={() => updateCurvePoints(createDefaultCurve())}
                  aria-label="Reset active curve"
                  className="p-0.5 text-zinc-400 hover:text-violet-500 ml-1"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {activeClip && (
            <RGBCurveEditor
              channel={curveChannel}
              points={activeClip.colorGrade.curves[curveChannel]}
              onChange={updateCurvePoints}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const ColorWheelControl: React.FC<{
  label: string;
  value: ColorWheelValue;
  onChange: (next: ColorWheelValue) => void;
}> = ({ label, value, onChange }) => {
  const wheelRef = useRef<HTMLDivElement>(null);

  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.type === 'pointermove') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - rect.left - cx) / (cx * 0.9)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - rect.top - cy) / (cy * 0.9)));
    // Map wheel polar offset to R/G/B balance
    const r = Number((nx * 0.7 - ny * 0.5).toFixed(2));
    const g = Number((-nx * 0.35 - ny * 0.5).toFixed(2));
    const b = Number((-nx * 0.35 + ny * 0.85).toFixed(2));
    onChange({ ...value, r, g, b });
  };

  // Inverse approximate dot position
  const dotX = Math.max(-0.85, Math.min(0.85, value.r - value.b * 0.5));
  const dotY = Math.max(-0.85, Math.min(0.85, value.b - value.r * 0.4));

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-between w-full text-[11px]">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        <button
          type="button"
          onClick={() => onChange({ r: 0, g: 0, b: 0, luma: 0 })}
          className="text-[10px] text-zinc-400 hover:text-violet-500"
        >
          Reset
        </button>
      </div>
      <div
        ref={wheelRef}
        role="slider"
        aria-label={`${label} color wheel`}
        aria-valuenow={Math.round(value.luma * 100)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handlePointer(e);
        }}
        onPointerMove={handlePointer}
        className="w-24 h-24 rounded-full relative cursor-crosshair border border-zinc-300 dark:border-zinc-700 shadow-inner"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(239,68,68,0.42), rgba(234,179,8,0.42), rgba(34,197,94,0.42), rgba(6,182,212,0.42), rgba(59,130,246,0.42), rgba(168,85,247,0.42), rgba(239,68,68,0.42))',
        }}
      >
        <div className="absolute inset-2 rounded-full bg-radial from-white/70 dark:from-[#13121a]/80 to-transparent pointer-events-none" />
        <div
          className="w-3 h-3 rounded-full bg-white border-2 border-violet-600 shadow absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${50 + dotX * 42}%`,
            top: `${50 + dotY * 42}%`,
          }}
        />
      </div>
      <input
        type="range"
        aria-label={`${label} luminance`}
        className="w-full studio-slider"
        min={-0.6}
        max={0.6}
        step={0.02}
        value={value.luma}
        onChange={(e) => onChange({ ...value, luma: parseFloat(e.target.value) })}
      />
    </div>
  );
};

const RGBCurveEditor: React.FC<{
  channel: CurveChannel;
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
}> = ({ channel, points, onChange }) => {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const strokeColor =
    channel === 'red'
      ? '#f43f5e'
      : channel === 'green'
      ? '#22c55e'
      : channel === 'blue'
      ? '#3b82f6'
      : '#a78bfa';

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const next = points.map((p, idx) =>
      idx === draggingIdx
        ? {
            x: idx === 0 ? 0 : idx === points.length - 1 ? 1 : Number(nx.toFixed(2)),
            y: Number(ny.toFixed(2)),
          }
        : p
    );
    onChange(next);
  };

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 200} ${(1 - p.y) * 180}`)
    .join(' ');

  return (
    <svg
      ref={svgRef}
      viewBox="-10 -10 220 200"
      aria-label={`${channel} tone curve editor`}
      onPointerMove={handleMove}
      onPointerUp={() => setDraggingIdx(null)}
      onPointerLeave={() => setDraggingIdx(null)}
      className="w-full h-[215px] rounded-md bg-[#0a0910] border border-zinc-800 select-none touch-none"
    >
      {/* Frame Border */}
      <rect x={0} y={0} width={200} height={180} fill="none" stroke="rgba(255,255,255,0.12)" />
      {/* Grid */}
      {[1, 2, 3].map((n) => (
        <React.Fragment key={n}>
          <line x1={n * 50} y1={0} x2={n * 50} y2={180} stroke="rgba(255,255,255,0.08)" />
          <line x1={0} y1={n * 45} x2={200} y2={n * 45} stroke="rgba(255,255,255,0.08)" />
        </React.Fragment>
      ))}
      {/* Neutral Diagonal */}
      <line
        x1={0}
        y1={180}
        x2={200}
        y2={0}
        stroke="rgba(255,255,255,0.18)"
        strokeDasharray="4 4"
      />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={2.5} />
      {points.map((p, idx) => (
        <circle
          key={idx}
          cx={p.x * 200}
          cy={(1 - p.y) * 180}
          r={5.5}
          fill="#ffffff"
          stroke={strokeColor}
          strokeWidth={2}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            e.stopPropagation();
            setDraggingIdx(idx);
          }}
        />
      ))}
    </svg>
  );
};

const GradeSlider: React.FC<{
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}> = ({ label, value, display, min, max, step, onChange }) => (
  <div className="space-y-0.5">
    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
      <span>{label}</span>
      <span className="font-mono text-zinc-800 dark:text-zinc-200 tabular-nums">{display}</span>
    </div>
    <input
      type="range"
      aria-label={label}
      className="w-full studio-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  </div>
);
