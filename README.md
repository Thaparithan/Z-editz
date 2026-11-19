# 🎬 Z-editz Pro - 4K 60FPS Video Editor

> **100% Offline • Zero Login / Account • No Ads • No Watermark • PC & Mobile Ready**

An ultra-modern, CapCut Pro-grade video & audio editing workstation engineered for high performance, creative freedom, and complete privacy.

---

## ✨ Key Features

### 🎨 CapCut Pro-Style Workspace
* **Dual Theme Engine**:
  * **Obsidian Cyber Neon (Dark Mode)**: Pure deep black `#07050d`, dark velvet surfaces, neon electric purple, neon cyan & pink glows.
  * **Velvet Elegance (Light Mode)**: Pure white `#ffffff`, soft velvet lilac surfaces, and royal velvet purple accents.
* **Aspect Ratio Switcher**: 1-click toggle between **16:9** (YouTube / PC), **9:16** (Reels / TikTok / Shorts), and **1:1** (Instagram).

### 🎵 Dedicated Audio Studio & Extractor
* **1-Click Audio Extraction**: Detach audio from any video clip into an independent, editable sound track with precomputed waveform peaks.
* **Voice Changer / FX**: Deep/Bass voice, Chipmunk (high pitch), Cyber Robot, Megaphone, Old Telephone, Echo/Delay.
* **Volume Envelope**: Volume slider (0% to 200%), Fade-in and Fade-out ramps.
* **Sound FX Library**: Whoosh transitions, Bass drops, Cyber glitch sounds, and Camera shutter clicks.

### ✂️ Non-Linear Multi-Track Timeline
* **Razor / Split Tool (`S` key)**: Split any clip at the current playhead position.
* **Magnetic Scrubber & Ruler**: Frame-accurate playhead tracking (`HH:MM:SS:FF` at 30/60fps).
* **Keyframing**: Diamond keyframe markers with smooth Bezier curve interpolation for Position (X, Y), Scale, Rotation, and Opacity.
* **Speed Ramping**: 0.25x slow-motion up to 4.0x fast-motion speed curves.
* **Multi-Track Support**: Main Video, PIP / Video Overlays, Text & Titles, Audio 1, and SFX / Voice tracks.

### 🎭 Visual FX, Shaders & Typography
* **Chroma Key (Green Screen)**: Color picker, similarity tolerance, smoothness, and spill reduction.
* **Video Effects**: RGB Split Glitch, Neon Aura Glow, Heavy Bass Shake, Retro VHS Lines, Speed Zoom Blur, Optical Flare.
* **Color Grading**: Brightness, Contrast, Saturation, Temperature, Vignette edges, Hue rotation, Blur.
* **Cinematic LUT Filters**: Cyber Neon, Moody Velvet, Teal & Orange, 90s VHS, Noir B&W, Golden Hour, Matrix Emerald.
* **16+ Aesthetic Fonts**: Cyberpunk Neon, Urban Heavy, Velvet Luxe, Clean Modern, Handwritten Script, etc.
* **Text Animations**: Typewriter effect, Pop-in, Smooth Fade, Cyber Glitch.

### 🚀 4K 60FPS Hardware Export
* **Resolutions**: 720p HD, 1080p Full HD, 2K QHD, **4K UHD (3840x2160)**.
* **Framerates**: 24 FPS, 30 FPS, **60 FPS**.
* **Bitrate Modes**: Standard, High, and Ultra Pro (up to 45 Mbps).
* **Formats**: MP4 Video, WebM Video, and pure Audio (WAV) export.
* **Zero Watermarks**: Clean, instant file download directly to your machine.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause Preview |
| `S` | Split / Cut Selected Clip at Playhead |
| `Delete` / `Backspace` | Delete Selected Clip |
| `Ctrl + Z` | Undo |
| `Ctrl + Shift + Z` | Redo |

---

## 🏃‍♂️ How to Run

```bash
# 1. Install dependencies (already completed)
npm install

# 2. Start Local Development Server
npm run dev

# 3. Open in Browser
# http://127.0.0.1:5173/

# 4. Build Production Bundle
npm run build
```

---

## 📱 Packaging for Mobile (Android / iOS) & Desktop (PC .exe)

### For PC Desktop App (Windows .exe / Mac .dmg):
```bash
npm install --save-dev electron electron-builder
```

### For Mobile App (Android APK / iOS):
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init Z-editz com.zeditz.app --web-dir dist
npx cap add android
```
