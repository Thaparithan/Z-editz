import React, { useRef } from 'react';
import { Upload, Plus, Film, Image as ImageIcon, Music, Sparkles } from 'lucide-react';
import { useEditor } from '../../store/editorContext';
import { Clip } from '../../types/editor';

// Sample royalty-free media clips for instant test editing
const SAMPLE_MEDIA = [
  {
    name: 'Cyberpunk Neon City',
    type: 'video' as const,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 15,
    tag: '4K Sample',
  },
  {
    name: 'Cinematic Nature Drone',
    type: 'video' as const,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 30,
    tag: '1080p 60fps',
  },
  {
    name: 'Neon Car Drift',
    type: 'video' as const,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    duration: 20,
    tag: 'Action',
  },
];

export const MediaPanel: React.FC = () => {
  const { addClip, currentTime } = useEditor();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle local user files (video, audio, image)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      const isImage = file.type.startsWith('image');

      const clipType = isVideo ? 'video' : isAudio ? 'audio' : 'image';
      const trackId = isVideo ? 'track-main-video' : isAudio ? 'track-audio' : 'track-overlay';

      const newClip: Omit<Clip, 'id'> = {
        trackId,
        name: file.name,
        type: clipType,
        sourceUrl: objectUrl,
        startTime: currentTime,
        duration: isAudio ? 20 : isImage ? 5 : 10,
        sourceStartTime: 0,
        sourceDuration: 60,
        volume: 1,
        speed: 1,
        fadeIn: 0,
        fadeOut: 0,
        isMuted: false,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        keyframes: [],
        blendMode: 'source-over',
        colorAdjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, vignette: 0, exposure: 0, hue: 0, blur: 0 },
        chromaKey: { enabled: false, color: '#00ff00', similarity: 30, smoothness: 10, spillReduction: 50 },
      };

      addClip(newClip);
    }
  };

  const handleAddSample = (sample: (typeof SAMPLE_MEDIA)[0]) => {
    addClip({
      trackId: 'track-main-video',
      name: sample.name,
      type: 'video',
      sourceUrl: sample.url,
      startTime: currentTime,
      duration: sample.duration,
      sourceStartTime: 0,
      sourceDuration: sample.duration,
      volume: 1,
      speed: 1,
      fadeIn: 0,
      fadeOut: 0,
      isMuted: false,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      keyframes: [],
      blendMode: 'source-over',
      colorAdjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, vignette: 0, exposure: 0, hue: 0, blur: 0 },
      chromaKey: { enabled: false, color: '#00ff00', similarity: 30, smoothness: 10, spillReduction: 50 },
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-purple-500/40 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer transition select-none group"
      >
        <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition shadow-md shadow-purple-500/20">
          <Upload size={22} />
        </div>
        <p className="text-xs font-bold text-[var(--text-primary)]">
          Import Media Files
        </p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          Supports 4K MP4, MOV, MP3, WAV, PNG, JPG
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Instant Sample Clips */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)] mb-2">
          <Sparkles size={14} className="text-purple-400" />
          <span>Quick Sample Clips (Test Instantly)</span>
        </div>

        <div className="space-y-2">
          {SAMPLE_MEDIA.map((item, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-purple-500/40 flex items-center justify-between group transition"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Film size={16} />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {item.name}
                  </p>
                  <span className="text-[10px] text-purple-400 font-mono">
                    {item.tag} • {item.duration}s
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleAddSample(item)}
                className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs flex items-center gap-1 shadow-sm transition"
              >
                <Plus size={14} />
                <span className="text-[10px] font-bold">Add</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
