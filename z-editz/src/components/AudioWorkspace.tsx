import React, { useEffect, useRef, useState } from 'react';
import { Activity, Mic, Square, Volume2, VolumeX } from 'lucide-react';
import type { ProjectState, TimelineTrack } from '../types/editor';
import type { ZEditzAudioEngine } from '../engine/audioEngine';
import { formatTimecode } from '../engine/timelineEngine';

interface AudioWorkspaceProps {
  project: ProjectState;
  currentTime: number;
  isPlaying: boolean;
  audioEngine: ZEditzAudioEngine;
  onTogglePlay: () => void;
  onUpdateTrack: (trackId: string, patch: Partial<TimelineTrack>) => void;
  onAddBeatMarkers: () => void;
  onVoiceoverRecorded: (blob: Blob, durationSec: number) => void;
}

export const AudioWorkspace: React.FC<AudioWorkspaceProps> = ({
  project,
  currentTime,
  isPlaying,
  audioEngine,
  onTogglePlay,
  onUpdateTrack,
  onAddBeatMarkers,
  onVoiceoverRecorded,
}) => {
  const [meters, setMeters] = useState({ left: 0, right: 0, leftDb: -60, rightDb: -60 });
  const [recording, setRecording] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recElapsed, setRecElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStartRef = useRef<number>(0);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      setMeters(audioEngine.getMeterLevels());
      if (recording) {
        setRecElapsed((performance.now() - recStartRef.current) / 1000);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [audioEngine, recording]);

  const audioTracks = project.tracks.filter((t) => t.type === 'audio');

  const startVoiceover = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const dur = Math.max(1, (performance.now() - recStartRef.current) / 1000);
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        onVoiceoverRecorded(blob, Number(dur.toFixed(2)));
        setRecording(false);
        setRecElapsed(0);
      };
      recStartRef.current = performance.now();
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setRecError(
        'Microphone access was unavailable or denied. You can also import local WAV/MP3 files from the Media bin.'
      );
    }
  };

  const stopVoiceover = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const volToDb = (vol: number) =>
    vol <= 0.01 ? '-∞ dB' : `${vol >= 1 ? '+' : ''}${(20 * Math.log10(vol)).toFixed(1)} dB`;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#f5f4f9] dark:bg-[#0d0c13] overflow-hidden">
      {/* Top Studio Header Bar */}
      <div className="px-5 py-3 border-b border-[#e4e1ee] dark:border-[#242233] bg-white dark:bg-[#13121a] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-base font-bold text-zinc-950 dark:text-white">
            Audio Mixing Console
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            48 kHz 32-bit float bus · Per-track 3-band EQ, stereo panning, dynamics & voiceover capture
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-xs text-violet-700 dark:text-violet-300 font-semibold tabular-nums">
            {formatTimecode(currentTime, project.settings.fps)}
          </span>
          <button
            type="button"
            onClick={onTogglePlay}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500 text-white transition-colors"
          >
            {isPlaying ? 'Pause Mix' : 'Audition Mix'}
          </button>
          <button
            type="button"
            onClick={onAddBeatMarkers}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#1b1925] border border-[#ddd9e8] dark:border-[#2c293d] text-zinc-800 dark:text-zinc-200 hover:border-violet-500 transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Detect Beat Markers</span>
          </button>
          {!recording ? (
            <button
              type="button"
              onClick={startVoiceover}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record Voiceover</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopVoiceover}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-700 text-white"
            >
              <Square className="w-3 h-3 fill-current" />
              <span className="font-mono">Stop ({recElapsed.toFixed(1)}s)</span>
            </button>
          )}
        </div>
      </div>

      {recError && (
        <div className="mx-5 mt-3 px-3.5 py-2 rounded-md text-xs bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-800 dark:text-amber-300">
          {recError}
        </div>
      )}

      {/* Channel Strips + Master Stereo VU Bus */}
      <div className="flex-1 min-h-0 p-5 overflow-auto">
        <div className="flex items-stretch gap-4 min-h-[420px]">
          {audioTracks.map((track) => (
            <div
              key={track.id}
              className="w-60 shrink-0 rounded-lg bg-white dark:bg-[#14131c] border border-[#e4e1ee] dark:border-[#262438] p-4 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#e4e1ee] dark:border-[#242233]">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {track.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                      aria-label={`Mute ${track.name}`}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        track.muted
                          ? 'bg-rose-600 text-white'
                          : 'bg-zinc-100 dark:bg-[#1f1d2c] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateTrack(track.id, { solo: !track.solo })}
                      aria-label={`Solo ${track.name}`}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        track.solo
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-zinc-100 dark:bg-[#1f1d2c] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      S
                    </button>
                  </div>
                </div>

                {/* 3-Band EQ */}
                <div className="mt-3 space-y-2 text-[11px]">
                  <div className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Parametric EQ
                  </div>
                  {(
                    [
                      ['eqLow', 'Low 180Hz'],
                      ['eqMid', 'Mid 1kHz'],
                      ['eqHigh', 'High 5.5kHz'],
                    ] as const
                  ).map(([field, lbl]) => (
                    <div key={field} className="space-y-0.5">
                      <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                        <span>{lbl}</span>
                        <span className="font-mono tabular-nums">
                          {track[field] > 0 ? '+' : ''}
                          {track[field].toFixed(1)} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        aria-label={`${track.name} ${lbl}`}
                        className="w-full studio-slider"
                        min={-12}
                        max={12}
                        step={0.5}
                        value={track[field]}
                        onChange={(e) =>
                          onUpdateTrack(track.id, { [field]: parseFloat(e.target.value) })
                        }
                      />
                    </div>
                  ))}
                </div>

                {/* Pan & Dynamics */}
                <div className="mt-3 pt-3 border-t border-[#e4e1ee] dark:border-[#242233] space-y-2 text-[11px]">
                  <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                    <span>Stereo Pan</span>
                    <span className="font-mono">
                      {track.pan === 0
                        ? 'C'
                        : track.pan < 0
                        ? `L${Math.round(Math.abs(track.pan) * 100)}`
                        : `R${Math.round(track.pan * 100)}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={`${track.name} stereo pan`}
                    className="w-full studio-slider"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={track.pan}
                    onChange={(e) => onUpdateTrack(track.id, { pan: parseFloat(e.target.value) })}
                  />
                  <label className="flex items-center justify-between pt-1 cursor-pointer text-zinc-700 dark:text-zinc-300">
                    <span>Dynamics Compressor</span>
                    <input
                      type="checkbox"
                      checked={track.compressor}
                      onChange={(e) =>
                        onUpdateTrack(track.id, { compressor: e.target.checked })
                      }
                      className="accent-violet-600"
                    />
                  </label>
                </div>
              </div>

              {/* Channel Gain Fader */}
              <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] flex flex-col items-center gap-2">
                <div className="flex items-center justify-between w-full text-[11px]">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    {track.muted ? (
                      <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    )}
                    Gain
                  </span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {volToDb(track.volume)}
                  </span>
                </div>
                <input
                  type="range"
                  aria-label={`${track.name} gain fader`}
                  className="w-full studio-slider"
                  min={0}
                  max={1.8}
                  step={0.02}
                  value={track.volume}
                  onChange={(e) => onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          ))}

          {/* Master Output Stereo Bus & Real-Time VU Meter */}
          <div className="w-64 shrink-0 rounded-lg bg-white dark:bg-[#14131c] border border-violet-300 dark:border-violet-500/40 p-4 flex flex-col justify-between">
            <div>
              <div className="pb-2.5 border-b border-[#e4e1ee] dark:border-[#242233] flex items-center justify-between">
                <span className="text-xs font-bold text-violet-800 dark:text-violet-300">
                  Master Stereo Bus
                </span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  -14 LUFS Target
                </span>
              </div>

              {/* Live L/R Peak Meters */}
              <div className="mt-5 flex items-end justify-center gap-6 h-52">
                {(
                  [
                    ['L', meters.left, meters.leftDb],
                    ['R', meters.right, meters.rightDb],
                  ] as const
                ).map(([ch, level, db]) => (
                  <div key={ch} className="flex flex-col items-center gap-2 h-full">
                    <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {db <= -59 ? '-∞' : `${db}`} dB
                    </span>
                    <div className="w-7 flex-1 rounded bg-zinc-200 dark:bg-[#0c0b10] border border-zinc-300 dark:border-zinc-800 overflow-hidden flex flex-col justify-end p-0.5">
                      <div
                        className="w-full rounded-sm transition-all duration-75"
                        style={{
                          height: `${Math.max(2, Math.round(level * 100))}%`,
                          background:
                            level > 0.85
                              ? '#ef4444'
                              : level > 0.65
                              ? '#f59e0b'
                              : '#14b8a6',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {ch}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#e4e1ee] dark:border-[#242233] text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>Limiter Threshold</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">-14.0 dB</span>
              </div>
              <div className="flex justify-between">
                <span>Sample Rate</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {project.settings.sampleRate} Hz
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
