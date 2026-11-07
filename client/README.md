# ProxiSpeak - Frontend Client

> **High-Performance 2D Virtual World & WebRTC Spatial Audio Ecosystem**  
> Built with **React 18**, **HTML5 Canvas (60 FPS)**, **WebRTC**, **Web Audio API**, and **Tailwind CSS**.

---

## 🎯 Overview

The **ProxiSpeak Client** reproduces the spontaneous, organic dynamics of an in-person physical office. Remote team members explore an overhead 2D virtual office using customizable avatars. When colleagues walk within each other's **100-pixel earshot radius**, standard peer-to-peer WebRTC audio handshakes are automatically orchestrated in real-time, dynamically mixing volume and 3D stereo panning through the browser's **Web Audio API**.

---

## 🏗️ Architecture & Core Modules

```
client/src/
├── components/
│   ├── CanvasWorld.jsx       # HTML5 Canvas 2D virtual office world engine (steady 60 FPS)
│   ├── ControlsOverlay.jsx   # Mic mute/unmute, deafen, radar, and diagnostics action dock
│   ├── SpatialRadar.jsx      # 360° proximity radar HUD showing nearby peer angles & earshot
│   ├── UserList.jsx          # Live roster displaying active users, distances, and pan/gain telemetry
│   ├── JoinModal.jsx         # Welcome screen for name, avatar color, and room floor selection
│   └── DiagnosticsModal.jsx  # Audio check, 3D stereo pan test synthesizer & <20ms audit runner
├── services/
│   ├── socketService.js      # Socket.io communication (movement, room presence, WebRTC signaling)
│   ├── webrtcService.js      # RTCPeerConnection mesh manager with proximity-gated lifecycle
│   ├── spatialAudioService.js# Web Audio API engine (GainNode, StereoPannerNode, BiquadFilterNode)
│   └── audioMeterService.js  # Microphone volume analyzer & real-time speaking ripple detector
├── utils/
│   ├── geometry.js           # 2D Euclidean distance, stereo pan ratio, and line/rectangle ray-casting
│   └── colors.js             # Avatar color palette presets and RGBA converters
├── App.jsx                   # Master state coordinator & event dispatcher
├── config.js                 # Configuration constants (server URL, earshot radius, ICE servers)
└── index.css                 # Global styling, Tailwind imports, and keyframe animations
```

---

## 🚀 Key Modules & Functionality

### 1. 2D Virtual World (`CanvasWorld.jsx`)
- **Steady 60 FPS Rendering**: Utilizes `requestAnimationFrame` with smooth interpolation (lerping) and sub-millisecond delta-time stepping.
- **Dual Navigation**:
  - **Keyboard**: Smooth continuous movement via `W`, `A`, `S`, `D` or `Arrow Keys` with normalized diagonal velocities.
  - **Mouse**: Click or drag anywhere on the canvas to set a destination target marker.
- **100px Earshot Radius Ring**: Soft pulsing radial glow centered on your avatar, visually illustrating the precise boundary where WebRTC audio activates.
- **Acoustic Line-of-Sight Rays**: Renders connection beams between avatars within earshot:
  - 🟢 **Green (Clear)**: Unobstructed line-of-sight.
  - 🟠 **Amber (Muffled)**: Sound passing through glass conference walls or acoustic cubicle partitions.
  - 🔴 **Red (Blocked)**: Sound completely absorbed by soundproof booth walls.
- **Avatar Badges**: Displays user initials, colored border, hovering nameplates, speaking ripple halos, and mute/deafen status icons.

### 2. Real-Time Audio & WebRTC Mesh (`webrtcService.js`)
- Standard WebRTC audio streaming utilizing browser `navigator.mediaDevices.getUserMedia`.
- **Proximity-Guarded Handshake**: WebRTC offers and answers are only exchanged when avatars enter the 100-pixel earshot radius, preventing unnecessary network mesh overload.
- Graceful connection cleanup when moving beyond earshot.
- Microphone mute toggle and automatic silent audio stream fallback for headless testing.

### 3. Spatial Audio Mixer (`spatialAudioService.js`)
Connects remote WebRTC audio streams to the browser's **Web Audio API**:
$$\text{MediaStream} \longrightarrow \text{BiquadFilterNode} \longrightarrow \text{GainNode} \longrightarrow \text{StereoPannerNode} \longrightarrow \text{MasterGain} \longrightarrow \text{Destination}$$

- **Dynamic Distance Attenuation (Week 3)**:
  Volume decays smoothly as avatars move apart according to quadratic roll-off:
  $$\text{Gain}(d) = \max\left(0,\, 1 - \left(\frac{d}{R}\right)^{1.5}\right) \quad \text{for } d \le 100\text{px}$$
- **3D Stereo Panning (Week 4)**:
  `StereoPannerNode` emphasizes the left channel if a colleague is to your left, or the right channel if to your right:
  $$\text{Pan} = \text{clamp}\left(-1.0,\, +1.0,\, \frac{\Delta x}{100}\right)$$
- **Acoustic Sound Occlusion (Week 4)**:
  A `BiquadFilterNode` applies acoustic low-pass filtering (cutting off high frequencies above 750 Hz) whenever sound travels through conference room glass walls or room partitions, creating realistic architectural muffling.

### 4. Audio Check & Diagnostics Suite (`DiagnosticsModal.jsx`)
- **Stereo Separation Tester**: Single-click sound synthesizer testing Left Ear (`-1.0`), Center (`0.0`), and Right Ear (`+1.0`) stereo channels.
- **360° Orbit Sweep**: Sweeps a harmonic tone continuously around the listener to verify headphone spatial separation.
- **Distance Drop-Off Preview**: Previews volume levels at 20px, 50px, 75px, and 95px.
- **Live Backend Latency Benchmark**: Queries the MongoDB geospatial audit endpoint in real-time to verify the project's **<20ms** latency requirement.

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended, tested on Node v22.16.0)
- **ProxiSpeak Backend Server** running on `http://localhost:5000`

### 1. Install Dependencies
```bash
cd client
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
The client will boot with Vite and be accessible at:  
👉 **`http://localhost:5173`** (or `http://localhost:3000`)

### 3. Build for Production
```bash
npm run build
```
Generates optimized, bundled static assets inside `client/dist`.

### 4. Preview Production Build
```bash
npm run preview
```

---

## ⚙️ Environment Configuration

You can override default settings via a `.env` file in the `client` directory:

```env
# URL pointing to the ProxiSpeak Express/Socket.io backend
VITE_SERVER_URL=http://localhost:5000
```

---

## 🧪 Testing Multi-User Spatial Audio

To experience proximity audio on a single development computer:

1. Open **Tab 1** in your browser at `http://localhost:5173`:
   - Name: `Alice`
   - Color: Blue
   - Click **Enter Virtual Office**.
2. Open **Tab 2** (e.g. in an Incognito window or second browser like Chrome/Firefox/Edge) at `http://localhost:5173`:
   - Name: `Bob`
   - Color: Emerald Green
   - Click **Enter Virtual Office**.
3. Use the `W`, `A`, `S`, `D` keys or click on the canvas:
   - Walk `Alice` closer to `Bob` within the **100px earshot circle**.
   - Notice the green acoustic beam appear and the notification toast: **"🎙️ Bob is within earshot! Audio connected."**
   - Speak into your microphone and observe the animated speaking halos around your avatar.
   - Walk `Alice` to the left of `Bob` -> voice pans to Bob's left ear.
   - Walk `Alice` into **Conference Room A** behind the glass wall -> voice becomes realistically muffled by the acoustic occlusion filter.
   - Walk `Alice` into the **Soundproof Booth** -> audio drops to zero (100% soundproof).
   - Walk `Alice` away (>100px) -> WebRTC connection automatically unloads.