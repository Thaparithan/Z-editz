import type { MediaAsset, ProjectState, TimelineClip } from '../types/editor';
import { evaluateKeyframes } from './keyframes';

interface ActiveAudioNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  clipId: string;
}

/**
 * Web Audio API real-time multi-track audio playback, procedural cinema stem synthesizer,
 * 3-band EQ, stereo panning, compressor, and live L/R peak VU metering.
 */
export class ZEditzAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private speakerGain: GainNode | null = null;
  private exportDestination: MediaStreamAudioDestinationNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private activeNodes = new Map<string, ActiveAudioNode>();
  private isPlaying = false;
  private timeDataL = new Float32Array(256);
  private timeDataR = new Float32Array(256);

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.9;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.ratio.value = 3;

      const splitter = this.ctx.createChannelSplitter(2);
      this.analyserL = this.ctx.createAnalyser();
      this.analyserR = this.ctx.createAnalyser();
      this.analyserL.fftSize = 256;
      this.analyserR.fftSize = 256;

      this.masterGain.connect(this.compressor);

      this.speakerGain = this.ctx.createGain();
      this.speakerGain.gain.value = 1.0;
      this.compressor.connect(this.speakerGain);
      this.speakerGain.connect(this.ctx.destination);

      this.exportDestination = this.ctx.createMediaStreamDestination();
      this.compressor.connect(this.exportDestination);

      this.compressor.connect(splitter);
      splitter.connect(this.analyserL, 0);
      splitter.connect(this.analyserR, 1);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getExportAudioStream(): MediaStream | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.exportDestination) return null;
    return this.exportDestination.stream;
  }

  /**
   * Generates a warm, studio-quality procedural ambient stereo AudioBuffer
   * for built-in demo audio stems so playback has genuine sound & live meters offline.
   */
  private getOrSynthesizeBuffer(asset: MediaAsset, ctx: AudioContext): AudioBuffer | null {
    const cached = this.bufferCache.get(asset.id);
    if (cached) return cached;

    if (!asset.isBuiltin) return null;

    const sr = ctx.sampleRate;
    const duration = Math.min(25, Math.max(4, asset.duration));
    const frameCount = Math.floor(sr * duration);
    const buffer = ctx.createBuffer(2, frameCount, sr);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const isPulse = asset.audioPreset === 'pulse-synth';
    const freqs = isPulse ? [146.83, 220.0, 293.66, 329.63] : [130.81, 196.0, 246.94, 293.66];

    for (let i = 0; i < frameCount; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 1.2) * Math.min(1, (duration - t) * 1.2);
      const pulseMod = isPulse ? 0.45 + 0.55 * Math.pow(Math.sin(t * Math.PI * 2.0), 2) : 0.72 + 0.28 * Math.sin(t * 0.45);
      let sL = 0;
      let sR = 0;
      for (let f = 0; f < freqs.length; f++) {
        const w = freqs[f] * Math.PI * 2;
        sL += Math.sin(w * t + f * 0.3) * (0.14 / (f + 1));
        sR += Math.sin((w * 1.003) * t + f * 0.9) * (0.14 / (f + 1));
      }
      left[i] = sL * env * pulseMod * 0.42;
      right[i] = sR * env * pulseMod * 0.42;
    }

    this.bufferCache.set(asset.id, buffer);
    return buffer;
  }

  public async decodeFileAsset(assetId: string, file: File): Promise<{ duration: number; waveform: number[] }> {
    const ctx = this.ensureContext();
    if (!ctx) {
      return { duration: 10, waveform: new Array(96).fill(0.35) };
    }
    try {
      const arrayBuf = await file.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
      this.bufferCache.set(assetId, audioBuf);

      const channel = audioBuf.getChannelData(0);
      const bars = 96;
      const step = Math.max(1, Math.floor(channel.length / bars));
      const waveform: number[] = [];
      for (let i = 0; i < bars; i++) {
        let peak = 0;
        const start = i * step;
        const end = Math.min(channel.length, start + step);
        for (let j = start; j < end; j += Math.max(1, Math.floor(step / 32))) {
          const val = Math.abs(channel[j]);
          if (val > peak) peak = val;
        }
        waveform.push(Number(Math.min(1, Math.max(0.06, peak)).toFixed(3)));
      }
      return { duration: Number(audioBuf.duration.toFixed(2)), waveform };
    } catch {
      return { duration: 10, waveform: new Array(96).fill(0.35) };
    }
  }

  public startPlayback(
    project: ProjectState,
    currentTime: number,
    options: { muteSpeaker?: boolean } = {}
  ) {
    this.stopPlayback();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    if (this.speakerGain) {
      this.speakerGain.gain.value = options.muteSpeaker ? 0 : 1;
    }

    this.isPlaying = true;
    const anySolo = project.tracks.some((t) => t.type === 'audio' && t.solo);
    const assetsById = new Map(project.assets.map((a) => [a.id, a]));

    for (const track of project.tracks) {
      if (track.type !== 'audio') continue;
      const trackMuted = track.muted || (anySolo && !track.solo);
      if (trackMuted) continue;

      const trackClips = project.clips.filter(
        (c) => c.trackId === track.id && !c.audio.muted && c.startTime + c.duration > currentTime
      );

      for (const clip of trackClips) {
        const asset = assetsById.get(clip.assetId);
        if (!asset) continue;
        const buffer = this.bufferCache.get(asset.id) ?? this.getOrSynthesizeBuffer(asset, ctx);
        if (!buffer) continue;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = Math.max(0.25, Math.min(4, clip.speed));

        const eqLow = ctx.createBiquadFilter();
        eqLow.type = 'lowshelf';
        eqLow.frequency.value = 180;
        eqLow.gain.value = track.eqLow + clip.audio.eqLow;

        const eqMid = ctx.createBiquadFilter();
        eqMid.type = 'peaking';
        eqMid.frequency.value = 1000;
        eqMid.gain.value = track.eqMid + clip.audio.eqMid;

        const eqHigh = ctx.createBiquadFilter();
        eqHigh.type = 'highshelf';
        eqHigh.frequency.value = 5500;
        eqHigh.gain.value = track.eqHigh + clip.audio.eqHigh;

        const panner = ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, track.pan + clip.audio.pan));

        const gain = ctx.createGain();
        const localTime = Math.max(0, currentTime - clip.startTime);
        const vol = evaluateKeyframes(clip.keyframes.volume, localTime, clip.audio.volume) * track.volume;
        gain.gain.value = Math.max(0, Math.min(2, vol));

        source.connect(eqLow);
        eqLow.connect(eqMid);
        eqMid.connect(eqHigh);
        eqHigh.connect(panner);
        panner.connect(gain);
        gain.connect(this.masterGain);

        const delay = Math.max(0, clip.startTime - currentTime);
        const offset = Math.max(0, clip.mediaOffset + localTime * clip.speed) % Math.max(0.1, buffer.duration);
        const playDur = Math.max(0.05, clip.duration - localTime);

        try {
          source.start(ctx.currentTime + delay, offset, playDur);
          this.activeNodes.set(clip.id, {
            source,
            gain,
            panner,
            eqLow,
            eqMid,
            eqHigh,
            clipId: clip.id,
          });
        } catch {
          // Safe fallback if offset exceeds short buffer
        }
      }
    }
  }

  public updateLiveMix(project: ProjectState, currentTime: number) {
    if (!this.isPlaying || !this.ctx) return;
    const anySolo = project.tracks.some((t) => t.type === 'audio' && t.solo);
    const tracksById = new Map(project.tracks.map((t) => [t.id, t]));
    const clipsById = new Map(project.clips.map((c) => [c.id, c]));

    for (const [clipId, node] of this.activeNodes.entries()) {
      const clip: TimelineClip | undefined = clipsById.get(clipId);
      if (!clip) continue;
      const track = tracksById.get(clip.trackId);
      if (!track) continue;

      const muted = track.muted || clip.audio.muted || (anySolo && !track.solo);
      const localTime = Math.max(0, currentTime - clip.startTime);
      let fadeMul = 1;
      if (clip.audio.fadeIn > 0 && localTime < clip.audio.fadeIn) {
        fadeMul *= localTime / clip.audio.fadeIn;
      }
      const rem = clip.duration - localTime;
      if (clip.audio.fadeOut > 0 && rem < clip.audio.fadeOut) {
        fadeMul *= Math.max(0, rem / clip.audio.fadeOut);
      }
      const kfVol = evaluateKeyframes(clip.keyframes.volume, localTime, clip.audio.volume);
      const targetGain = muted ? 0 : Math.max(0, Math.min(2, kfVol * track.volume * fadeMul));

      node.gain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.03);
      node.panner.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, track.pan + clip.audio.pan)),
        this.ctx.currentTime,
        0.03
      );
      node.eqLow.gain.setTargetAtTime(track.eqLow + clip.audio.eqLow, this.ctx.currentTime, 0.04);
      node.eqMid.gain.setTargetAtTime(track.eqMid + clip.audio.eqMid, this.ctx.currentTime, 0.04);
      node.eqHigh.gain.setTargetAtTime(track.eqHigh + clip.audio.eqHigh, this.ctx.currentTime, 0.04);
    }
  }

  public stopPlayback() {
    this.isPlaying = false;
    if (this.speakerGain && this.ctx) {
      this.speakerGain.gain.setValueAtTime(1, this.ctx.currentTime);
    }
    for (const node of this.activeNodes.values()) {
      try {
        node.source.stop();
        node.source.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeNodes.clear();
  }

  public getMeterLevels(): { left: number; right: number; leftDb: number; rightDb: number } {
    if (!this.isPlaying || !this.analyserL || !this.analyserR) {
      return { left: 0, right: 0, leftDb: -60, rightDb: -60 };
    }
    this.analyserL.getFloatTimeDomainData(this.timeDataL);
    this.analyserR.getFloatTimeDomainData(this.timeDataR);

    let peakL = 0;
    let peakR = 0;
    for (let i = 0; i < this.timeDataL.length; i++) {
      const al = Math.abs(this.timeDataL[i]);
      const ar = Math.abs(this.timeDataR[i]);
      if (al > peakL) peakL = al;
      if (ar > peakR) peakR = ar;
    }

    const left = Math.min(1, peakL * 2.4);
    const right = Math.min(1, peakR * 2.4);
    const leftDb = left > 0.001 ? Math.max(-60, Math.round(20 * Math.log10(left))) : -60;
    const rightDb = right > 0.001 ? Math.max(-60, Math.round(20 * Math.log10(right))) : -60;
    return { left, right, leftDb, rightDb };
  }
}
