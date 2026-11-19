import React, { useState } from 'react';
import { X, Download, Sparkles, CheckCircle2, Film, Music, AlertCircle, Loader2 } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { exportEngine } from '../../engine/exportEngine';
import { ExportSettings } from '../../types/editor';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const {
    clips,
    totalDuration,
    aspectRatio,
    exportSettings,
    setExportSettings,
    isExporting,
    setIsExporting,
    exportProgress,
    setExportProgress,
    videoElements,
  } = useEditor();

  const [exportComplete, setExportComplete] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    if (clips.length === 0) {
      setErrorMessage('Timeline has no clips to export! Add a video or text clip first.');
      return;
    }

    setErrorMessage(null);
    setExportComplete(false);
    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await exportEngine.exportTimeline(
        clips,
        totalDuration,
        aspectRatio,
        exportSettings,
        videoElements.current,
        (progress) => {
          setExportProgress(progress);
        }
      );

      const ext = exportSettings.format === 'mp3' || exportSettings.format === 'wav' ? 'wav' : 'mp4';
      const filename = `Z-editz_${exportSettings.resolution}_${exportSettings.fps}fps_${Date.now()}.${ext}`;
      exportEngine.triggerDownload(blob, filename);

      setIsExporting(false);
      setExportComplete(true);
    } catch (err: unknown) {
      setIsExporting(false);
      if (err instanceof Error && err.message !== 'Export cancelled by user') {
        setErrorMessage(err.message || 'Export error occurred');
      }
    }
  };

  const handleCancel = () => {
    if (isExporting) {
      exportEngine.cancelExport();
      setIsExporting(false);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-purple-500/30">
            <Film size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              Export Video & Audio
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                PRO 4K
              </span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              No Watermark • 60FPS Hardware Acceleration • 100% Free
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Card */}
        {exportComplete ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-3">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
              Export Complete!
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-xs mb-5">
              Your {exportSettings.resolution.toUpperCase()} video has been rendered and saved directly to your downloads.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/30"
            >
              Done & Return to Edit
            </button>
          </div>
        ) : isExporting ? (
          /* Live Progress State */
          <div className="py-6">
            <div className="flex items-center justify-between text-xs font-semibold mb-2 text-[var(--text-primary)]">
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-purple-500" />
                Rendering Frame-by-Frame...
              </span>
              <span className="font-mono text-purple-400 text-sm font-bold">
                {exportProgress}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden p-0.5 mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 transition-all duration-150"
                style={{ width: `${exportProgress}%` }}
              />
            </div>

            <p className="text-[11px] text-center text-[var(--text-secondary)]">
              Rendering at {exportSettings.resolution.toUpperCase()} @ {exportSettings.fps}FPS. Please keep this tab open.
            </p>

            <div className="mt-5 flex justify-center">
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-xs font-semibold text-[var(--text-secondary)] transition"
              >
                Cancel Render
              </button>
            </div>
          </div>
        ) : (
          /* Settings Form */
          <div className="space-y-4">
            {/* Resolution Selector */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] mb-1.5 block">
                Resolution
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['720p', '1080p', '2k', '4k'] as ExportSettings['resolution'][]).map((res) => (
                  <button
                    key={res}
                    onClick={() => setExportSettings((prev) => ({ ...prev, resolution: res }))}
                    className={`py-2 px-1 rounded-xl border text-center transition flex flex-col items-center ${
                      exportSettings.resolution === res
                        ? 'border-purple-500 bg-purple-500/15 text-purple-400 font-bold shadow-sm shadow-purple-500/20'
                        : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-purple-500/40'
                    }`}
                  >
                    <span className="text-xs uppercase">{res}</span>
                    <span className="text-[10px] opacity-70">
                      {res === '4k' ? 'UHD Pro' : res === '2k' ? 'QHD' : res === '1080p' ? 'Full HD' : 'HD'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Framerate & Quality */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] mb-1.5 block">
                  Frame Rate (FPS)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([24, 30, 60] as ExportSettings['fps'][]).map((fps) => (
                    <button
                      key={fps}
                      onClick={() => setExportSettings((prev) => ({ ...prev, fps }))}
                      className={`py-1.5 rounded-lg border text-xs font-semibold transition ${
                        exportSettings.fps === fps
                          ? 'border-purple-500 bg-purple-500/15 text-purple-400'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] mb-1.5 block">
                  Bitrate Quality
                </label>
                <select
                  value={exportSettings.quality}
                  onChange={(e) =>
                    setExportSettings((prev) => ({
                      ...prev,
                      quality: e.target.value as ExportSettings['quality'],
                    }))
                  }
                  className="w-full h-[34px] rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                >
                  <option value="ultra_pro">Ultra Pro (High Bitrate 4K)</option>
                  <option value="high">High Quality (Balanced)</option>
                  <option value="standard">Standard (Compact File)</option>
                </select>
              </div>
            </div>

            {/* Format selection */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] mb-1.5 block">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setExportSettings((prev) => ({ ...prev, format: 'mp4' }))}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition ${
                    exportSettings.format === 'mp4'
                      ? 'border-purple-500 bg-purple-500/15 text-purple-400'
                      : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Film size={14} />
                  <span>MP4 Video</span>
                </button>
                <button
                  onClick={() => setExportSettings((prev) => ({ ...prev, format: 'webm' }))}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition ${
                    exportSettings.format === 'webm'
                      ? 'border-purple-500 bg-purple-500/15 text-purple-400'
                      : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Film size={14} />
                  <span>WebM Video</span>
                </button>
                <button
                  onClick={() => setExportSettings((prev) => ({ ...prev, format: 'wav' }))}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition ${
                    exportSettings.format === 'wav'
                      ? 'border-purple-500 bg-purple-500/15 text-purple-400'
                      : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Music size={14} />
                  <span>Audio (WAV)</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleStartExport}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition transform active:scale-95"
              >
                <Download size={14} />
                <span>Start 4K Export</span>
                <Sparkles size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
