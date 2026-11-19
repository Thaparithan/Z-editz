# Z-editz 🎬

> Offline-first professional non-linear video editor with multi-track timeline, real-time compositing, color scopes, audio mixing, keyframes, Gemini AI features, and synchronized video export.

---

## 📥 Direct Downloads & Installers

Ready-to-use installers for both Android and Windows Laptop are available directly in this repository:

| Platform | Installer | Details |
| :--- | :--- | :--- |
| 📱 **Android Mobile** | [**Download Z-editz.apk**](./dist-installers/Z-editz.apk) | Direct APK install for Android smartphones and tablets (API 26+) |
| 💻 **Windows Desktop / Laptop** | [**GitHub Releases (Z-editz-Windows-Laptop.zip)**](https://github.com/Thaparithan/Z-editz/releases) | Standalone portable executable (`Z-editz.exe`) with Desktop shortcut launcher |

---

## 🚀 Quick Start (Development)

From this root folder:

```bash
# 1. Install dependencies
cd z-editz && npm install

# 2. (Optional) Configure Gemini API Key in z-editz/.env.local:
# GEMINI_API_KEY="your-gemini-api-key"

# 3. Start local development server
npm run dev
```

Or from root:
```bash
npm run dev
```

---

## ✨ Features & Architecture

* **Multi-Track Timeline**: V1, V2, Title, Audio, Overlay tracks with ripple editing, snapping, trimming, slip editing, speed controls, keyframe partitioning, and 80-depth undo/redo history.
* **Compositor Engine**: 2D Canvas painter's algorithm, procedural overlays (film grain, light leaks, bokeh, scanlines), transitions, spatial keyframing, and video hardware sync.
* **DaVinci Resolve Style Color Grading**: Lift/Gamma/Gain 3-way color wheels, 256-LUT RGB curves, chroma keying, and real-time scopes (RGB Parade, Waveform, 256-bin Histogram, Vectorscope).
* **Gemini AI Integration**:
  * **Gemini Auto-Subtitles**: Transcribe audio/video voiceover directly into timestamped SRT subtitles.
  * **Gemini AI Colorist**: Natural language prompt-based color grading (e.g. *"vintage 70s warm cinema film"*).
* **Web Audio Studio**: 3-band parametric EQ, dynamics compressor, stereo panning, live VU metering, and microphone voiceover capture.
* **Synchronized Video Export**: Offscreen canvas compositing + Web Audio stream destination recording for genuine, in-sync downloadable video files.
* **IndexedDB Persistence**: Offline persistent storage for projects and imported video/audio blobs that survive browser refreshes.

