// Z-editz Pro Audio Engine - Web Audio API & Waveform Generator

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Load and decode an audio buffer from an audio/video URL or file blob
  async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    if (this.audioBuffers.has(url)) {
      return this.audioBuffers.get(url)!;
    }
    const ctx = this.getContext();
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.audioBuffers.set(url, audioBuffer);
    return audioBuffer;
  }

  // Generate visual waveform peak data for timeline rendering
  generateWaveformData(audioBuffer: AudioBuffer, samples: number = 100): number[] {
    const rawData = audioBuffer.getChannelData(0); // primary channel
    const blockSize = Math.floor(rawData.length / samples);
    const peaks: number[] = [];

    for (let i = 0; i < samples; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j]);
      }
      const avg = sum / blockSize;
      peaks.push(Math.min(1, avg * 3.5)); // Normalized with boost for visibility
    }
    return peaks;
  }

  // Extract audio from video file and create a standalone audio WAV blob URL
  async extractAudioFromVideo(videoUrl: string): Promise<{ audioUrl: string; duration: number; waveform: number[] }> {
    const buffer = await this.loadAudioBuffer(videoUrl);
    const waveform = this.generateWaveformData(buffer, 120);
    const wavBlob = this.audioBufferToWav(buffer);
    const audioUrl = URL.createObjectURL(wavBlob);
    return {
      audioUrl,
      duration: buffer.duration,
      waveform,
    };
  }

  // Play audio clip with voice changer and volume/fade envelope
  playClip(
    clipId: string,
    buffer: AudioBuffer,
    startTimeInClip: number,
    duration: number,
    volume: number,
    fadeIn: number,
    fadeOut: number,
    voiceEffect?: string
  ) {
    this.stopClip(clipId);
    const ctx = this.getContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Pitch shifting for voice effects
    if (voiceEffect === 'chipmunk') {
      source.playbackRate.value = 1.45;
    } else if (voiceEffect === 'deep') {
      source.playbackRate.value = 0.75;
    }

    const gainNode = ctx.createGain();
    const now = ctx.currentTime;

    // Apply volume envelope
    gainNode.gain.setValueAtTime(0.0001, now);
    if (fadeIn > 0) {
      gainNode.gain.linearRampToValueAtTime(volume, now + Math.min(fadeIn, duration / 2));
    } else {
      gainNode.gain.setValueAtTime(volume, now);
    }

    if (fadeOut > 0 && duration > fadeOut) {
      const fadeStartTime = now + duration - fadeOut;
      gainNode.gain.setValueAtTime(volume, fadeStartTime);
      gainNode.gain.linearRampToValueAtTime(0.0001, now + duration);
    }

    // Voice FX Chains
    let lastNode: AudioNode = source;
    if (voiceEffect === 'telephone' || voiceEffect === 'megaphone') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 3.0;
      lastNode.connect(filter);
      lastNode = filter;
    } else if (voiceEffect === 'robot') {
      const ringMod = ctx.createBiquadFilter();
      ringMod.type = 'peaking';
      ringMod.frequency.value = 440;
      ringMod.gain.value = 25;
      lastNode.connect(ringMod);
      lastNode = ringMod;
    }

    lastNode.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(0, Math.max(0, startTimeInClip), duration);
    this.activeSources.set(clipId, source);

    source.onended = () => {
      this.activeSources.delete(clipId);
    };
  }

  stopClip(clipId: string) {
    const existing = this.activeSources.get(clipId);
    if (existing) {
      try {
        existing.stop();
      } catch {
        // already stopped
      }
      this.activeSources.delete(clipId);
    }
  }

  stopAll() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore
      }
    });
    this.activeSources.clear();
  }

  // Convert Web AudioBuffer to standard WAV Blob for export and sharing
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    let result: Float32Array;

    if (numChannels === 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      result = new Float32Array(left.length + right.length);
      for (let i = 0; i < left.length; i++) {
        result[i * 2] = left[i];
        result[i * 2 + 1] = right[i];
      }
    } else {
      result = buffer.getChannelData(0);
    }

    const dataLength = result.length * (bitDepth / 8);
    const bufferArray = new ArrayBuffer(44 + dataLength);
    const view = new DataView(bufferArray);

    // Write WAV Header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM 16-bit Samples
    let offset = 44;
    for (let i = 0; i < result.length; i++) {
      const s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }
}

export const audioEngine = new AudioEngine();
