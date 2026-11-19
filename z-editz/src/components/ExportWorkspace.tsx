import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  Film,
  Loader2,
  Play,
  Subtitles,
} from 'lucide-react';
import type { ExportJob, ExportPreset, ProjectState } from '../types/editor';
import { EXPORT_PRESETS } from '../engine/presets';
import { formatTimecode, getProjectDuration } from '../engine/timelineEngine';

interface ExportWorkspaceProps {
  project: ProjectState;
  exportJobs: ExportJob[];
  onStartRenderJob: (config: {
    name: string;
    presetName: string;
    width: number;
    height: number;
    fps: number;
    videoBitrateKbps: number;
    format: ExportPreset['format'];
  }) => void;
  onDownloadProjectJson: () => void;
  onDownloadSrt: () => void;
}

export const ExportWorkspace: React.FC<ExportWorkspaceProps> = ({
  project,
  exportJobs,
  onStartRenderJob,
  onDownloadProjectJson,
  onDownloadSrt,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(EXPORT_PRESETS[0].id);
  const [outputName, setOutputName] = useState(
    project.settings.name.replace(/\s+/g, '_')
  );
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState(60);
  const [bitrateKbps, setBitrateKbps] = useState(12000);
  const [format, setFormat] = useState<ExportPreset['format']>('webm-vp9');
  const [rightsConfirmed, setRightsConfirmed] = useState(true);

  const duration = getProjectDuration(project.clips);
  const renderSpan =
    project.settings.inPoint !== null && project.settings.outPoint !== null
      ? Math.max(0.5, project.settings.outPoint - project.settings.inPoint)
      : duration;

  const estMb = ((bitrateKbps / 8 / 1000) * renderSpan).toFixed(1);

  const applyPreset = (preset: ExportPreset) => {
    setSelectedPresetId(preset.id);
    setWidth(preset.width);
    setHeight(preset.height);
    setFps(preset.fps);
    setBitrateKbps(preset.videoBitrateKbps);
    setFormat(preset.format);
  };

  const handleQueueExport = (e: React.FormEvent) => {
    e.preventDefault();
    const preset = EXPORT_PRESETS.find((p) => p.id === selectedPresetId);
    onStartRenderJob({
      name: outputName.trim() || 'Z_editz_Master',
      presetName: preset?.name ?? 'Custom Export',
      width,
      height,
      fps,
      videoBitrateKbps: bitrateKbps,
      format,
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#f5f4f9] dark:bg-[#0d0c13] p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Presets & Encoding Settings */}
        <form
          onSubmit={handleQueueExport}
          className="lg:col-span-7 rounded-xl bg-white dark:bg-[#14131c] border border-[#e4e1ee] dark:border-[#262438] p-6 space-y-6"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#e4e1ee] dark:border-[#242233] pb-4">
            <div>
              <h1 className="text-lg font-bold text-zinc-950 dark:text-white">
                Export & Render Settings
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Offline local encoding via browser Canvas + MediaRecorder · No cloud upload
              </p>
            </div>
            <div className="text-right font-mono text-xs text-zinc-600 dark:text-zinc-400 shrink-0">
              <div>Span: {formatTimecode(renderSpan, project.settings.fps)}</div>
              <div>Est: ~{estMb} MB</div>
            </div>
          </div>

          {/* Preset Selector */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Delivery Presets
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EXPORT_PRESETS.map((preset) => {
                const active = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-violet-50 dark:bg-violet-500/15 border-violet-600 dark:border-violet-500'
                        : 'bg-[#f8f7fb] dark:bg-[#191724] border-[#e4e1ee] dark:border-[#282538] hover:border-violet-400'
                    }`}
                  >
                    <div className="text-xs font-semibold text-zinc-950 dark:text-white">
                      {preset.name}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                      {preset.width}×{preset.height} · {preset.fps}fps ·{' '}
                      {(preset.videoBitrateKbps / 1000).toFixed(1)} Mbps
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label
                htmlFor="export-filename"
                className="block font-medium text-zinc-700 dark:text-zinc-300"
              >
                Output Filename
              </label>
              <input
                id="export-filename"
                type="text"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#f8f7fb] dark:bg-[#1b1926] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-950 dark:text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="export-format"
                className="block font-medium text-zinc-700 dark:text-zinc-300"
              >
                Codec & Container
              </label>
              <select
                id="export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportPreset['format'])}
                className="w-full px-3 py-2 rounded-md bg-[#f8f7fb] dark:bg-[#1b1926] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-950 dark:text-white"
              >
                <option value="webm-vp9">WebM · VP9 (Open Royalty-Free)</option>
                <option value="webm-vp8">WebM · VP8 (Wide Compatibility)</option>
                <option value="mp4-h264">MP4 · H.264 (Fallback to WebM if unsupported)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="export-fps"
                className="block font-medium text-zinc-700 dark:text-zinc-300"
              >
                Frame Rate
              </label>
              <select
                id="export-fps"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-[#f8f7fb] dark:bg-[#1b1926] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-950 dark:text-white font-mono"
              >
                <option value={24}>24 fps (Cinema)</option>
                <option value={30}>30 fps (Standard)</option>
                <option value={60}>60 fps (High Motion)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="export-width"
                className="block font-medium text-zinc-700 dark:text-zinc-300"
              >
                Width (px)
              </label>
              <input
                id="export-width"
                type="number"
                min={320}
                max={3840}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-[#f8f7fb] dark:bg-[#1b1926] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-950 dark:text-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="export-height"
                className="block font-medium text-zinc-700 dark:text-zinc-300"
              >
                Height (px)
              </label>
              <input
                id="export-height"
                type="number"
                min={240}
                max={2160}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-[#f8f7fb] dark:bg-[#1b1926] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-950 dark:text-white font-mono"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <div className="flex justify-between">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  Target Video Bitrate
                </span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100">
                  {(bitrateKbps / 1000).toFixed(1)} Mbps
                </span>
              </div>
              <input
                type="range"
                aria-label="Target video bitrate"
                className="w-full studio-slider"
                min={2000}
                max={40000}
                step={500}
                value={bitrateKbps}
                onChange={(e) => setBitrateKbps(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Rights & Compliance Notice */}
          <div className="p-3.5 rounded-lg bg-[#f8f7fb] dark:bg-[#191724] border border-[#e4e1ee] dark:border-[#282538] space-y-2 text-xs">
            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
              Asset Licensing & Offline Privacy Compliance
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Built-in typography uses Open Fonts (SIL Open Font License) and included cinema plates
              & procedural audio stems are royalty-free. All media stays strictly on your device.
            </p>
            <label className="flex items-center gap-2 text-[11px] text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="accent-violet-600"
              />
              <span>I hold commercial or personal usage rights for any custom media imported.</span>
            </label>
          </div>

          {/* Primary Render & Companion Exports */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownloadProjectJson}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-[#f8f7fb] dark:bg-[#1b1926] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-800 dark:text-zinc-200 hover:border-violet-500 transition-colors"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Project JSON</span>
              </button>
              <button
                type="button"
                onClick={onDownloadSrt}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-[#f8f7fb] dark:bg-[#1b1926] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-800 dark:text-zinc-200 hover:border-violet-500 transition-colors"
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>Captions (.SRT)</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!rightsConfirmed}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-md bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500 text-white transition-colors disabled:opacity-45"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Local Render</span>
            </button>
          </div>
        </form>

        {/* Right: Render Queue */}
        <div className="lg:col-span-5 rounded-xl bg-white dark:bg-[#14131c] border border-[#e4e1ee] dark:border-[#262438] p-6 flex flex-col gap-4">
          <div className="border-b border-[#e4e1ee] dark:border-[#242233] pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Render Queue
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {exportJobs.length} {exportJobs.length === 1 ? 'job' : 'jobs'} processed this session
              </p>
            </div>
            <Film className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>

          <div className="space-y-3 flex-1">
            {exportJobs.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-lg border border-dashed border-[#dcd8e8] dark:border-[#2a273b] text-xs text-zinc-500 dark:text-zinc-400">
                Choose a preset and click <strong className="text-zinc-800 dark:text-zinc-200">Start Local Render</strong> to encode a playable video file directly in your browser.
              </div>
            ) : (
              exportJobs.map((job) => (
                <div
                  key={job.id}
                  data-testid={`export-job-${job.id}`}
                  className="p-3.5 rounded-lg bg-[#f8f7fb] dark:bg-[#191724] border border-[#e4e1ee] dark:border-[#282538] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-950 dark:text-white truncate">
                        {job.name}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        {job.presetName} · {job.width}×{job.height} · {job.fps}fps
                      </div>
                    </div>
                    <span className="text-[11px] font-medium shrink-0 flex items-center gap-1">
                      {job.status === 'rendering' && (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                          <span className="font-mono text-violet-600 dark:text-violet-400">
                            {job.progress}%
                          </span>
                        </>
                      )}
                      {job.status === 'completed' && (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-700 dark:text-emerald-400">Ready</span>
                        </>
                      )}
                      {job.status === 'failed' && (
                        <span className="text-rose-600 dark:text-rose-400">Failed</span>
                      )}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        job.status === 'completed'
                          ? 'bg-emerald-500'
                          : job.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-violet-600'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>

                  {job.error && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{job.error}</p>
                  )}

                  {job.status === 'completed' && job.downloadUrl && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        {job.fileSizeBytes
                          ? `${(job.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
                          : 'WebM Ready'}
                      </span>
                      <a
                        href={job.downloadUrl}
                        download={`${job.name}.webm`}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-violet-700 hover:bg-violet-800 text-white transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Video</span>
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
