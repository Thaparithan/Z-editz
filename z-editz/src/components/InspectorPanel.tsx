import React, { useState } from 'react';
import {
  Diamond,
  FlipHorizontal2,
  FlipVertical2,
  RotateCcw,
  Sliders,
  Sparkles,
  Type,
  Volume2,
} from 'lucide-react';
import type {
  BlendMode,
  InterpolationMode,
  KeyframeChannel,
  MaskShape,
  MotionPresetType,
  TimelineClip,
} from '../types/editor';
import {
  evaluateClipTransformAtTime,
  hasKeyframeNearTime,
  removeKeyframeAtTime,
  upsertKeyframe,
} from '../engine/keyframes';
import { MOTION_PRESETS, TRANSITION_LIBRARY } from '../engine/presets';
import { createDefaultTransform } from '../engine/timelineEngine';

type InspectorTab = 'transform' | 'fx' | 'text' | 'audio';

interface InspectorPanelProps {
  clip: TimelineClip | null;
  playheadTime: number;
  onUpdateClip: (clipId: string, updater: (clip: TimelineClip) => TimelineClip) => void;
  onChangeSpeed: (clipId: string, speed: number) => void;
  onSlipClip: (clipId: string, delta: number) => void;
}

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'lighter', label: 'Add (Lighter)' },
  { value: 'difference', label: 'Difference' },
];

const MASK_SHAPES: { value: MaskShape; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'vignette', label: 'Soft Vignette' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  clip,
  playheadTime,
  onUpdateClip,
  onChangeSpeed,
  onSlipClip,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('transform');
  const [kfInterpolation, setKfInterpolation] = useState<InterpolationMode>('ease-in-out');

  if (!clip) {
    return (
      <aside
        aria-label="Clip Inspector"
        className="flex flex-col h-full bg-[#f8f7fb] dark:bg-[#13121a] border-l border-[#e4e1ee] dark:border-[#242233] p-5 items-center justify-center text-center"
      >
        <Sliders className="w-6 h-6 text-zinc-400 dark:text-zinc-500 mb-2" />
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          No Clip Selected
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-[200px]">
          Click any clip on the timeline to inspect transforms, keyframes, speed, masks, filters, or audio.
        </p>
      </aside>
    );
  }

  const localTime = Math.max(0, Math.min(clip.duration, playheadTime - clip.startTime));
  const evaluated = evaluateClipTransformAtTime(clip, localTime);

  const toggleKeyframe = (channel: KeyframeChannel, currentVal: number) => {
    onUpdateClip(clip.id, (c) => {
      const exists = hasKeyframeNearTime(c.keyframes, channel, localTime);
      return {
        ...c,
        keyframes: exists
          ? removeKeyframeAtTime(c.keyframes, channel, localTime)
          : upsertKeyframe(c.keyframes, channel, localTime, currentVal, kfInterpolation),
      };
    });
  };

  const setAnimatableTransform = (
    channel: 'x' | 'y' | 'scale' | 'rotation' | 'opacity',
    val: number
  ) => {
    onUpdateClip(clip.id, (c) => {
      const hasKfs = (c.keyframes[channel]?.length ?? 0) > 0;
      return {
        ...c,
        transform: { ...c.transform, [channel]: val },
        keyframes: hasKfs
          ? upsertKeyframe(c.keyframes, channel, localTime, val, kfInterpolation)
          : c.keyframes,
      };
    });
  };

  const tabs: { id: InspectorTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: 'transform', label: 'Motion', icon: <Sliders className="w-3.5 h-3.5" />, show: true },
    { id: 'fx', label: 'FX / Mask', icon: <Sparkles className="w-3.5 h-3.5" />, show: clip.type !== 'audio' },
    { id: 'text', label: 'Title', icon: <Type className="w-3.5 h-3.5" />, show: clip.type === 'title' },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3.5 h-3.5" />, show: true },
  ];

  const effectiveTab = tabs.find((t) => t.id === activeTab && t.show)
    ? activeTab
    : clip.type === 'title'
    ? 'text'
    : 'transform';

  return (
    <aside
      aria-label="Clip Inspector"
      className="flex flex-col h-full bg-[#f8f7fb] dark:bg-[#13121a] border-l border-[#e4e1ee] dark:border-[#242233] min-w-0 overflow-hidden"
    >
      {/* Selected Clip Header */}
      <div className="px-3 py-2 border-b border-[#e4e1ee] dark:border-[#242233] bg-white/80 dark:bg-[#100f16] shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {clip.name}
          </span>
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 shrink-0">
            {clip.duration.toFixed(2)}s
          </span>
        </div>
      </div>

      {/* Inspector Tabs */}
      <div className="flex items-center border-b border-[#e4e1ee] dark:border-[#242233] px-1.5 pt-1.5 gap-0.5 bg-white/50 dark:bg-[#100f16] shrink-0">
        {tabs
          .filter((t) => t.show)
          .map((t) => {
            const active = effectiveTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#f8f7fb] dark:bg-[#13121a] text-violet-700 dark:text-violet-300 border-t border-x border-[#e4e1ee] dark:border-[#242233]'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
      </div>

      {/* Inspector Scroll Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {/* TRANSFORM & TIME TAB */}
        {effectiveTab === 'transform' && (
          <>
            {clip.type !== 'audio' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Transform & Keyframes
                  </span>
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Keyframe easing interpolation"
                      value={kfInterpolation}
                      onChange={(e) => setKfInterpolation(e.target.value as InterpolationMode)}
                      className="text-[11px] rounded bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300"
                    >
                      <option value="linear">Linear</option>
                      <option value="ease-in">Ease In</option>
                      <option value="ease-out">Ease Out</option>
                      <option value="ease-in-out">Ease In-Out</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateClip(clip.id, (c) => ({
                          ...c,
                          transform: createDefaultTransform(),
                          keyframes: {},
                        }))
                      }
                      aria-label="Reset transform"
                      title="Reset Transform & Keyframes"
                      className="p-1 rounded text-zinc-500 hover:text-violet-600 dark:hover:text-violet-300"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scale */}
                <KeyframeSlider
                  label="Scale"
                  value={evaluated.scale}
                  display={`${Math.round(evaluated.scale * 100)}%`}
                  min={0.1}
                  max={3}
                  step={0.01}
                  hasKey={hasKeyframeNearTime(clip.keyframes, 'scale', localTime)}
                  keyCount={clip.keyframes.scale?.length ?? 0}
                  onToggleKey={() => toggleKeyframe('scale', evaluated.scale)}
                  onChange={(v) => setAnimatableTransform('scale', v)}
                />

                {/* Position X */}
                <KeyframeSlider
                  label="Position X"
                  value={evaluated.x}
                  display={`${Math.round(evaluated.x)} px`}
                  min={-500}
                  max={500}
                  step={1}
                  hasKey={hasKeyframeNearTime(clip.keyframes, 'x', localTime)}
                  keyCount={clip.keyframes.x?.length ?? 0}
                  onToggleKey={() => toggleKeyframe('x', evaluated.x)}
                  onChange={(v) => setAnimatableTransform('x', v)}
                />

                {/* Position Y */}
                <KeyframeSlider
                  label="Position Y"
                  value={evaluated.y}
                  display={`${Math.round(evaluated.y)} px`}
                  min={-400}
                  max={400}
                  step={1}
                  hasKey={hasKeyframeNearTime(clip.keyframes, 'y', localTime)}
                  keyCount={clip.keyframes.y?.length ?? 0}
                  onToggleKey={() => toggleKeyframe('y', evaluated.y)}
                  onChange={(v) => setAnimatableTransform('y', v)}
                />

                {/* Rotation */}
                <KeyframeSlider
                  label="Rotation"
                  value={evaluated.rotation}
                  display={`${Math.round(evaluated.rotation)}°`}
                  min={-180}
                  max={180}
                  step={1}
                  hasKey={hasKeyframeNearTime(clip.keyframes, 'rotation', localTime)}
                  keyCount={clip.keyframes.rotation?.length ?? 0}
                  onToggleKey={() => toggleKeyframe('rotation', evaluated.rotation)}
                  onChange={(v) => setAnimatableTransform('rotation', v)}
                />

                {/* Opacity */}
                <KeyframeSlider
                  label="Opacity"
                  value={evaluated.opacity}
                  display={`${Math.round(evaluated.opacity * 100)}%`}
                  min={0}
                  max={1}
                  step={0.01}
                  hasKey={hasKeyframeNearTime(clip.keyframes, 'opacity', localTime)}
                  keyCount={clip.keyframes.opacity?.length ?? 0}
                  onToggleKey={() => toggleKeyframe('opacity', evaluated.opacity)}
                  onChange={(v) => setAnimatableTransform('opacity', v)}
                />

                {/* Flip Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateClip(clip.id, (c) => ({
                        ...c,
                        transform: { ...c.transform, flipH: !c.transform.flipH },
                      }))
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                      clip.transform.flipH
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white dark:bg-[#1b1925] border-[#ddd9e8] dark:border-[#2c293d] text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                    <span>Flip H</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateClip(clip.id, (c) => ({
                        ...c,
                        transform: { ...c.transform, flipV: !c.transform.flipV },
                      }))
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                      clip.transform.flipV
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white dark:bg-[#1b1925] border-[#ddd9e8] dark:border-[#2c293d] text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <FlipVertical2 className="w-3.5 h-3.5" />
                    <span>Flip V</span>
                  </button>
                </div>
              </div>
            )}

            {/* Speed & Time Manipulation */}
            <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2.5">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                Time & Speed
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span>Speed</span>
                  <span className="font-mono">{clip.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  aria-label="Clip playback speed"
                  className="w-full studio-slider"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={clip.speed}
                  onChange={(e) => onChangeSpeed(clip.id, parseFloat(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clip.reversed}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (c) => ({ ...c, reversed: e.target.checked }))
                    }
                    className="accent-violet-600"
                  />
                  <span>Reverse Playback</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSlipClip(clip.id, -0.5)}
                    className="px-2 py-1 text-[11px] rounded bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-700 dark:text-zinc-300 hover:border-violet-500"
                  >
                    Slip -0.5s
                  </button>
                  <button
                    type="button"
                    onClick={() => onSlipClip(clip.id, 0.5)}
                    className="px-2 py-1 text-[11px] rounded bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-700 dark:text-zinc-300 hover:border-violet-500"
                  >
                    Slip +0.5s
                  </button>
                </div>
              </div>
            </div>

            {/* Motion Preset */}
            {clip.type !== 'audio' && (
              <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2">
                <label className="block font-semibold text-zinc-800 dark:text-zinc-200">
                  Animation Preset
                </label>
                <select
                  aria-label="Clip animation preset"
                  value={clip.motionPreset}
                  onChange={(e) =>
                    onUpdateClip(clip.id, (c) => ({
                      ...c,
                      motionPreset: e.target.value as MotionPresetType,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100"
                >
                  {MOTION_PRESETS.map((mp) => (
                    <option key={mp.id} value={mp.id}>
                      {mp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* FX, CROP, COMPOSITING & MASK TAB */}
        {effectiveTab === 'fx' && clip.type !== 'audio' && (
          <>
            {/* Blend Mode & Filter Intensity */}
            <div className="space-y-2.5">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                Compositing & Filter
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-600 dark:text-zinc-400">
                  Blend Mode
                </label>
                <select
                  aria-label="Blend mode"
                  value={clip.blendMode}
                  onChange={(e) =>
                    onUpdateClip(clip.id, (c) => ({
                      ...c,
                      blendMode: e.target.value as BlendMode,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100"
                >
                  {BLEND_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {clip.filterPresetId !== 'none' && (
                <SimpleSlider
                  label={`Filter Intensity (${clip.filterPresetId})`}
                  value={clip.filterIntensity}
                  display={`${Math.round(clip.filterIntensity * 100)}%`}
                  min={0}
                  max={1}
                  step={0.02}
                  onChange={(v) =>
                    onUpdateClip(clip.id, (c) => ({ ...c, filterIntensity: v }))
                  }
                />
              )}

              <SimpleSlider
                label="Gaussian Blur"
                value={clip.colorGrade.blur}
                display={`${clip.colorGrade.blur.toFixed(1)} px`}
                min={0}
                max={16}
                step={0.5}
                onChange={(v) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    colorGrade: { ...c.colorGrade, blur: v },
                  }))
                }
              />
            </div>

            {/* Crop */}
            <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">Crop (%)</div>
              <div className="grid grid-cols-2 gap-2.5">
                {(['top', 'bottom', 'left', 'right'] as const).map((edge) => (
                  <SimpleSlider
                    key={edge}
                    label={edge[0].toUpperCase() + edge.slice(1)}
                    value={clip.crop[edge]}
                    display={`${clip.crop[edge]}%`}
                    min={0}
                    max={45}
                    step={1}
                    onChange={(v) =>
                      onUpdateClip(clip.id, (c) => ({
                        ...c,
                        crop: { ...c.crop, [edge]: v },
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            {/* Masking */}
            <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2.5">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">Mask</div>
              <select
                aria-label="Mask shape"
                value={clip.mask.shape}
                onChange={(e) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    mask: { ...c.mask, shape: e.target.value as MaskShape },
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100"
              >
                {MASK_SHAPES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {clip.mask.shape !== 'none' && (
                <SimpleSlider
                  label="Mask Scale"
                  value={clip.mask.scale}
                  display={`${Math.round(clip.mask.scale * 100)}%`}
                  min={0.25}
                  max={1.4}
                  step={0.02}
                  onChange={(v) =>
                    onUpdateClip(clip.id, (c) => ({
                      ...c,
                      mask: { ...c.mask, scale: v },
                    }))
                  }
                />
              )}
            </div>

            {/* Chroma Key (Green Screen) */}
            <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2.5">
              <label className="flex items-center justify-between font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <span>Chroma Key (Green Screen)</span>
                <input
                  type="checkbox"
                  checked={clip.chromaKey.enabled}
                  onChange={(e) =>
                    onUpdateClip(clip.id, (c) => ({
                      ...c,
                      chromaKey: { ...c.chromaKey, enabled: e.target.checked },
                    }))
                  }
                  className="accent-violet-600"
                />
              </label>
              {clip.chromaKey.enabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Key Color</span>
                    <input
                      type="color"
                      aria-label="Chroma key color"
                      value={clip.chromaKey.keyColor}
                      onChange={(e) =>
                        onUpdateClip(clip.id, (c) => ({
                          ...c,
                          chromaKey: { ...c.chromaKey, keyColor: e.target.value },
                        }))
                      }
                      className="w-8 h-6 rounded border-0 cursor-pointer"
                    />
                  </div>
                  <SimpleSlider
                    label="Similarity"
                    value={clip.chromaKey.similarity}
                    display={`${Math.round(clip.chromaKey.similarity * 100)}%`}
                    min={0.05}
                    max={0.85}
                    step={0.01}
                    onChange={(v) =>
                      onUpdateClip(clip.id, (c) => ({
                        ...c,
                        chromaKey: { ...c.chromaKey, similarity: v },
                      }))
                    }
                  />
                  <SimpleSlider
                    label="Smoothness"
                    value={clip.chromaKey.smoothness}
                    display={`${Math.round(clip.chromaKey.smoothness * 100)}%`}
                    min={0.02}
                    max={0.6}
                    step={0.01}
                    onChange={(v) =>
                      onUpdateClip(clip.id, (c) => ({
                        ...c,
                        chromaKey: { ...c.chromaKey, smoothness: v },
                      }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Transitions */}
            <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">Transitions</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    In ({clip.transitionIn.duration.toFixed(1)}s)
                  </label>
                  <select
                    aria-label="Transition in type"
                    value={clip.transitionIn.type}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (c) => ({
                        ...c,
                        transitionIn: {
                          ...c.transitionIn,
                          type: e.target.value as TimelineClip['transitionIn']['type'],
                        },
                      }))
                    }
                    className="w-full px-1.5 py-1 text-[11px] rounded bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d]"
                  >
                    {TRANSITION_LIBRARY.map((tr) => (
                      <option key={tr.type} value={tr.type}>
                        {tr.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Out ({clip.transitionOut.duration.toFixed(1)}s)
                  </label>
                  <select
                    aria-label="Transition out type"
                    value={clip.transitionOut.type}
                    onChange={(e) =>
                      onUpdateClip(clip.id, (c) => ({
                        ...c,
                        transitionOut: {
                          ...c.transitionOut,
                          type: e.target.value as TimelineClip['transitionOut']['type'],
                        },
                      }))
                    }
                    className="w-full px-1.5 py-1 text-[11px] rounded bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d]"
                  >
                    {TRANSITION_LIBRARY.map((tr) => (
                      <option key={tr.type} value={tr.type}>
                        {tr.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* TITLE TYPOGRAPHY TAB */}
        {effectiveTab === 'text' && clip.titleStyle && (
          <div className="space-y-3">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
              Title & Typography
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-600 dark:text-zinc-400">
                Headline Text
              </label>
              <input
                type="text"
                value={clip.titleStyle.text}
                onChange={(e) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    name: `Title · ${e.target.value.slice(0, 18) || 'Untitled'}`,
                    titleStyle: c.titleStyle ? { ...c.titleStyle, text: e.target.value } : undefined,
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-zinc-600 dark:text-zinc-400">
                Subtitle
              </label>
              <input
                type="text"
                value={clip.titleStyle.subtitle ?? ''}
                onChange={(e) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    titleStyle: c.titleStyle
                      ? { ...c.titleStyle, subtitle: e.target.value }
                      : undefined,
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">
                  Font (SIL OFL)
                </label>
                <select
                  aria-label="Title font family"
                  value={clip.titleStyle.fontFamily}
                  onChange={(e) =>
                    onUpdateClip(clip.id, (c) => ({
                      ...c,
                      titleStyle: c.titleStyle
                        ? { ...c.titleStyle, fontFamily: e.target.value }
                        : undefined,
                    }))
                  }
                  className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d]"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="DM Sans">DM Sans</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Georgia">Georgia Serif</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  aria-label="Title text color"
                  value={clip.titleStyle.color}
                  onChange={(e) =>
                    onUpdateClip(clip.id, (c) => ({
                      ...c,
                      titleStyle: c.titleStyle
                        ? { ...c.titleStyle, color: e.target.value }
                        : undefined,
                    }))
                  }
                  className="w-full h-7 rounded border-0 cursor-pointer"
                />
              </div>
            </div>

            <SimpleSlider
              label="Font Size"
              value={clip.titleStyle.fontSize}
              display={`${clip.titleStyle.fontSize} px`}
              min={18}
              max={110}
              step={2}
              onChange={(v) =>
                onUpdateClip(clip.id, (c) => ({
                  ...c,
                  titleStyle: c.titleStyle ? { ...c.titleStyle, fontSize: v } : undefined,
                }))
              }
            />

            <SimpleSlider
              label="Background Box Opacity"
              value={clip.titleStyle.backgroundOpacity}
              display={`${Math.round(clip.titleStyle.backgroundOpacity * 100)}%`}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) =>
                onUpdateClip(clip.id, (c) => ({
                  ...c,
                  titleStyle: c.titleStyle
                    ? { ...c.titleStyle, backgroundOpacity: v }
                    : undefined,
                }))
              }
            />
          </div>
        )}

        {/* AUDIO & EQ TAB */}
        {effectiveTab === 'audio' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                Clip Audio & Envelopes
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clip.audio.muted}
                  onChange={(e) =>
                    onUpdateClip(clip.id, (c) => ({
                      ...c,
                      audio: { ...c.audio, muted: e.target.checked },
                    }))
                  }
                  className="accent-violet-600"
                />
                <span>Mute</span>
              </label>
            </div>

            <KeyframeSlider
              label="Volume"
              value={evaluated.volume}
              display={`${Math.round(evaluated.volume * 100)}%`}
              min={0}
              max={2}
              step={0.02}
              hasKey={hasKeyframeNearTime(clip.keyframes, 'volume', localTime)}
              keyCount={clip.keyframes.volume?.length ?? 0}
              onToggleKey={() => toggleKeyframe('volume', evaluated.volume)}
              onChange={(v) =>
                onUpdateClip(clip.id, (c) => {
                  const hasKfs = (c.keyframes.volume?.length ?? 0) > 0;
                  return {
                    ...c,
                    audio: { ...c.audio, volume: v },
                    keyframes: hasKfs
                      ? upsertKeyframe(c.keyframes, 'volume', localTime, v, kfInterpolation)
                      : c.keyframes,
                  };
                })
              }
            />

            <SimpleSlider
              label="Stereo Pan"
              value={clip.audio.pan}
              display={
                clip.audio.pan === 0
                  ? 'Center'
                  : clip.audio.pan < 0
                  ? `L ${Math.round(Math.abs(clip.audio.pan) * 100)}`
                  : `R ${Math.round(clip.audio.pan * 100)}`
              }
              min={-1}
              max={1}
              step={0.05}
              onChange={(v) =>
                onUpdateClip(clip.id, (c) => ({
                  ...c,
                  audio: { ...c.audio, pan: v },
                }))
              }
            />

            <div className="grid grid-cols-2 gap-2.5">
              <SimpleSlider
                label="Fade In"
                value={clip.audio.fadeIn}
                display={`${clip.audio.fadeIn.toFixed(1)}s`}
                min={0}
                max={4}
                step={0.1}
                onChange={(v) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    audio: { ...c.audio, fadeIn: v },
                  }))
                }
              />
              <SimpleSlider
                label="Fade Out"
                value={clip.audio.fadeOut}
                display={`${clip.audio.fadeOut.toFixed(1)}s`}
                min={0}
                max={4}
                step={0.1}
                onChange={(v) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    audio: { ...c.audio, fadeOut: v },
                  }))
                }
              />
            </div>

            <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2.5">
              <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                3-Band Equalizer (dB)
              </div>
              <SimpleSlider
                label="Low (180 Hz)"
                value={clip.audio.eqLow}
                display={`${clip.audio.eqLow > 0 ? '+' : ''}${clip.audio.eqLow.toFixed(1)} dB`}
                min={-12}
                max={12}
                step={0.5}
                onChange={(v) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    audio: { ...c.audio, eqLow: v },
                  }))
                }
              />
              <SimpleSlider
                label="Mid (1 kHz)"
                value={clip.audio.eqMid}
                display={`${clip.audio.eqMid > 0 ? '+' : ''}${clip.audio.eqMid.toFixed(1)} dB`}
                min={-12}
                max={12}
                step={0.5}
                onChange={(v) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    audio: { ...c.audio, eqMid: v },
                  }))
                }
              />
              <SimpleSlider
                label="High (5.5 kHz)"
                value={clip.audio.eqHigh}
                display={`${clip.audio.eqHigh > 0 ? '+' : ''}${clip.audio.eqHigh.toFixed(1)} dB`}
                min={-12}
                max={12}
                step={0.5}
                onChange={(v) =>
                  onUpdateClip(clip.id, (c) => ({
                    ...c,
                    audio: { ...c.audio, eqHigh: v },
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

interface KeyframeSliderProps {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  hasKey: boolean;
  keyCount: number;
  onToggleKey: () => void;
  onChange: (value: number) => void;
}

const KeyframeSlider: React.FC<KeyframeSliderProps> = ({
  label,
  value,
  display,
  min,
  max,
  step,
  hasKey,
  keyCount,
  onToggleKey,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleKey}
          aria-label={`Toggle ${label} keyframe`}
          title={hasKey ? `Remove ${label} keyframe` : `Add ${label} keyframe at playhead`}
          className={`p-0.5 rounded transition-colors ${
            hasKey
              ? 'text-violet-600 dark:text-violet-400'
              : keyCount > 0
              ? 'text-amber-500'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <Diamond className={`w-3 h-3 ${hasKey ? 'fill-current' : ''}`} />
        </button>
        <span className="text-[11px] text-zinc-700 dark:text-zinc-300">{label}</span>
      </div>
      <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 tabular-nums">
        {display}
      </span>
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

interface SimpleSliderProps {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const SimpleSlider: React.FC<SimpleSliderProps> = ({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-zinc-600 dark:text-zinc-400 truncate">{label}</span>
      <span className="font-mono text-zinc-700 dark:text-zinc-300 tabular-nums">{display}</span>
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
