# ProxiSpeak: Geospatial Proximity Audio Ecosystem

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4-black.svg)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Peer--to--Peer-orange.svg)](https://webrtc.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-2D%20Geospatial-brightgreen.svg)](https://www.mongodb.com/)
[![Tests](https://img.shields.io/badge/Tests-9%20Passing-success.svg)]()

> **ProxiSpeak** replaces rigid video breakout rooms with the spontaneous, natural spatial acoustics of a real office. Avatars navigate a high-performance 2D virtual office on HTML5 Canvas. As you walk closer to colleagues, WebRTC audio dynamically crossfades, gets louder, and pans smoothly between your left and right ears using the browser's Web Audio API.

---

## 📋 Table of Contents
- [Problem Statement & Core Concept](#-problem-statement--core-concept)
- [System Architecture](#-system-architecture)
- [Module Breakdown & Week-by-Week Implementation](#-module-breakdown--week-by-week-implementation)
- [Directory Structure](#-directory-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Frontend Setup](#2-frontend-setup)
- [Running Tests & Benchmarks](#-running-tests--benchmarks)
  - [Unit & Integration Tests](#unit--integration-tests)
  - [Geospatial Latency Audit (<20ms Target)](#geospatial-latency-audit-20ms-target)
- [Testing Multi-User Spatial Audio (Walkthrough)](#-testing-multi-user-spatial-audio-walkthrough)
- [API & WebSocket Event Reference](#-api--websocket-event-reference)
- [License](#-license)

---

## 💡 Problem Statement & Core Concept

Remote collaboration tools (like Zoom or Teams) force users into rigid "rooms" where only one person can speak at a time. They lack the spontaneous, spatial dynamics of a real office where you can hear people talking nearby and organically walk over to join a conversation.

### The Mental Model
```
  [ WHERE ARE YOU? ]
          │
          ▼
   (X / Y Coordinates)
          │
          ▼
  [ WHO IS NEARBY? ]  ──► MongoDB 2D Index ($near & $geoWithin)
          │
          ▼
  Proximity Guard     ──► Is Distance ≤ 100px?
          │
          ├─► NO  ──► No WebRTC Audio Connection (Quiet / Out of Range)
          │
          └─► YES ──► Socket.io WebRTC Handshake (Offer / Answer / ICE)
                          │
                          ▼
                  [ Web Audio API Pipeline ]
                  - Volume Drop-Off (Quadratic Inverse Decay)
                  - 3D Stereo Panning (-1.0 Left to +1.0 Right)
                  - Acoustic Obstacle Occlusion (Biquad Low-Pass Filter)
                          │
                          ▼
                  [ What You Hear ]
```

---

## 🏛️ System Architecture

```
                                 ┌─────────────────────────────────────────────────────────┐
                                 │                 PROXISPEAK ECOSYSTEM                    │
                                 └────────────────────────────┬────────────────────────────┘
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼                                                                                 ▼
      ┌─────────────────────────────┐                                                   ┌─────────────────────────────┐
      │       FRONTEND CLIENT       │                                                   │       BACKEND SERVER        │
      │   (React 18 + Canvas API)   │                                                   │    (Node.js + Express)      │
      └──────────────┬──────────────┘                                                   └──────────────┬──────────────┘
                     │                                                                                 │
        ┌────────────┴────────────┐                                                       ┌────────────┴────────────┐
        ▼                         ▼                                                       ▼                         ▼
┌───────────────┐         ┌───────────────┐         WebSocket / Signaling        ┌─────────────────┐       ┌─────────────────┐
│  2D Canvas    │         │  Web Audio    │◄────────────────────────────────────►│ Socket.io Hub   │       │ MongoDB 2D      │
│  Office World │         │  API Mixer    │      (Positions, SDP & ICE)          │ (Signaling &    │       │ Geospatial      │
│  (60 FPS)     │         │ (Gain & Pan)  │                                      │  Transitions)   │       │ Engine ($near)  │
└───────────────┘         └───────▲───────┘                                      └─────────────────┘       └─────────────────┘
                                  │
                                  │ P2P Audio Streams
                                  ▼
                         ┌─────────────────┐
                         │ WebRTC Mesh     │ (Direct Browser-to-Browser Audio)
                         └─────────────────┘
```

---

## 📦 Module Breakdown & Week-by-Week Implementation

| Week | Backend Deliverable | Frontend Deliverable | Status |
| :--- | :--- | :--- | :---: |
| **Week 1** | **Signaling & Movement**: WebSocket server broadcasting avatar coordinates; basic MongoDB geospatial schemas. | **World Rendering**: React Canvas layer, 60 FPS animation loop, WASD/keyboard & mouse avatar navigation. | ✅ Completed |
| **Week 2** | **Proximity Calculations & Audit**: MongoDB `$near` queries; proximity-guarded signaling (offers/answers only for $\le 100$px); sub-20ms spatial latency audit. | **WebRTC Integration**: P2P audio using `getUserMedia`; proximity-triggered handshakes on entering earshot. | ✅ Completed |
| **Week 3** | **Dynamic Attenuation Engine**: Spatial proximity calculation and transition tracking (`entered`, `left`, `active`). | **Dynamic Volume Drop-off**: Web Audio API integration with smooth quadratic roll-off: $\text{Gain} = \max(0, 1 - (d / 100)^{1.5})$. | ✅ Completed |
| **Week 4** | **Room & Obstacle Persistence**: MongoDB persistence for rooms, furniture, glass walls, partitions, and soundproof booths. Ray-casting acoustic occlusion. | **Refine & Polish**: 3D audio panning (`StereoPannerNode`); acoustic low-pass filtering for muffled sound behind walls; radar HUD. | ✅ Completed |

---

## 📂 Directory Structure

```
ProxiSpeak/
├── client/                           # Frontend React Client
│   ├── src/
│   │   ├── components/
│   │   │   ├── CanvasWorld.jsx       # HTML5 Canvas 2D virtual office (steady 60 FPS)
│   │   │   ├── ControlsOverlay.jsx   # Mic mute/unmute, deafen, radar & diagnostic toggles
│   │   │   ├── SpatialRadar.jsx      # 360° proximity radar HUD with earshot perimeter
│   │   │   ├── UserList.jsx          # Live roster with active peers, distances & pan/gain
│   │   │   ├── JoinModal.jsx         # User onboarding, avatar color, and office floor picker
│   │   │   └── DiagnosticsModal.jsx  # Interactive audio synthesizer & live benchmark runner
│   │   ├── services/
│   │   │   ├── socketService.js      # Socket.io connection & event dispatching
│   │   │   ├── webrtcService.js      # WebRTC PeerConnection mesh with earshot gating
│   │   │   ├── spatialAudioService.js# Web Audio API mixer (Gain, StereoPanner, BiquadFilter)
│   │   │   └── audioMeterService.js  # Real-time microphone volume & speaking halo detector
│   │   ├── utils/
│   │   │   ├── geometry.js           # 2D distance, stereo pan, and obstacle ray-casting
│   │   │   └── colors.js             # Avatar color palette & helper utilities
│   │   ├── App.jsx                   # Root application coordinator
│   │   ├── config.js                 # Client settings (Server URL, 100px radius, STUN)
│   │   └── index.css                 # Tailwind CSS & custom animations
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
├── server/                           # Backend Node.js Engine
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                 # Mongoose connection & 2D index initialization
│   │   │   ├── environment.js        # Centralized environment variable loader
│   │   │   └── redis.js              # Redis Pub/Sub adapter configuration
│   │   ├── models/
│   │   │   ├── Room.js               # Office layouts & sound-blocking obstacles schema
│   │   │   └── UserLocation.js       # User spatial coordinates & MongoDB 2D index
│   │   ├── routes/
│   │   │   ├── roomRoutes.js         # REST endpoints for office rooms & obstacles
│   │   │   └── spatialRoutes.js      # Spatial queries, nearby search & audit benchmark
│   │   ├── services/
│   │   │   ├── audioOcclusionService.js # 2D acoustic ray-casting through walls/partitions
│   │   │   ├── auditService.js       # Automated <20ms geospatial latency benchmark
│   │   │   └── geospatialService.js  # Core 2D math, clustering, and memory cache
│   │   ├── sockets/
│   │   │   ├── index.js              # Socket.io connection & room lifecycle manager
│   │   │   ├── movementHandler.js    # Movement broadcasting & earshot transition engine
│   │   │   └── signalingHandler.js   # Proximity-guarded WebRTC signaling router
│   │   ├── app.js                    # Express application configuration
│   │   └── server.js                 # HTTP & WebSocket server entry point
│   ├── scripts/
│   │   ├── seedData.js               # Seeds office layout with walls and sample avatars
│   │   └── spatialAudit.js           # CLI benchmark runner measuring MongoDB query latency
│   ├── tests/
│   │   ├── geospatial.test.js        # Math & MongoDB $near query tests
│   │   ├── occlusion.test.js         # Sound ray-casting & obstacle intersection tests
│   │   └── signaling.test.js         # Earshot-guarded WebRTC signaling tests
│   └── package.json
├── shared/
│   └── events.js                     # Shared client-server event contracts
└── README.md                         # Master project documentation
```

---

## ⚡ Prerequisites

Before running ProxiSpeak, ensure you have the following installed:

1. **Node.js** (v18.0.0 or higher, tested on Node v22.16.0)
2. **MongoDB** (Local instance running on `mongodb://127.0.0.1:27017` or MongoDB Atlas URI)
3. **Modern Web Browser** with WebRTC and Web Audio API support (Chrome, Edge, Firefox, Brave, Safari)

---

## 🚀 Quick Start Guide

### 1. Backend Setup

Open a terminal in the root directory:

```bash
# Navigate to server
cd server

# Install backend dependencies
npm install

# Seed the database with the virtual office layout and obstacles
npm run seed

# Run the backend server
npm run dev
```

The backend server will start on **`http://localhost:5000`**:
- **Health Check**: `http://localhost:5000/health`
- **Rooms API**: `http://localhost:5000/api/rooms`
- **Spatial Audit**: `http://localhost:5000/api/spatial/audit`

### 2. Frontend Setup

Open a second terminal window:

```bash
# Navigate to client
cd client

# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```

The React client will launch at:
👉 **`http://localhost:5173`**

---

## 🧪 Running Tests & Benchmarks

### Unit & Integration Tests
ProxiSpeak features an automated test suite verifying spatial mathematics, MongoDB 2D indexes, acoustic ray-casting, and proximity-guarded WebRTC signaling:

```bash
cd server
npm test
```

Expected output:
```
✔ calculateDistance matches Euclidean 2D formula from project specification
✔ calculateDistanceGain produces smooth acoustic drop-off
✔ calculateStereoPan correctly pans audio left (-1.0) and right (+1.0)
✔ computeEarshotTransitions correctly detects entered and left peers
✔ MongoDB 2D geospatial $near query retrieves users within 100px radius
✔ segmentsIntersect correctly detects crossing line segments
✔ segmentIntersectsRectangle detects ray passing through rectangle
✔ isWithinEarshot returns true only when within 100px radius
✔ Signaling server only forwards WebRTC offer if target is within earshot
# 9 passing tests across 3 test suites
```

### Geospatial Latency Audit (<20ms Target)
Week 2 requires proving the backend accurately filters and clusters users based on geospatial coordinates under 20ms:

```bash
cd server
npm run audit
```

Benchmark results:
```
┌─────────┬─────────────────────────────────────────────┬─────────────┬─────────────┬──────────┬──────────┬──────────┬────────────────┐
│ (index) │ Scenario                                    │ Users Count │ Queries Run │ Min (ms) │ Avg (ms) │ P95 (ms) │ Status (<20ms) │
├─────────┼─────────────────────────────────────────────┼─────────────┼─────────────┼──────────┼──────────┼──────────┼────────────────┤
│ 0       │ 'Small Office (20 users)'                   │ 20          │ 50          │ 1.54     │ 2.69     │ 3.34     │ 'PASSED'       │
│ 1       │ 'Standard Office (50 users - Project Spec)' │ 50          │ 100         │ 1.44     │ 2.27     │ 2.49     │ 'PASSED'       │
│ 2       │ 'High Density Office (100 users)'           │ 100         │ 100         │ 1.46     │ 2.97     │ 3.38     │ 'PASSED'       │
└─────────┴─────────────────────────────────────────────┴─────────────┴─────────────┴──────────┴──────────┴──────────┴────────────────┘
✅ AUDIT VERIFICATION SUCCESSFUL: P95 latency is ~2.49ms (strictly under 20ms).
```

---

## 🎧 Testing Multi-User Spatial Audio (Walkthrough)

To experience the full spatial audio ecosystem on a single development machine:

1. **Open User 1 (Alice)**:
   - Navigate to `http://localhost:5173` in your primary browser.
   - Enter name `Alice`, select **Blue**, and click **Enter Virtual Office**.
2. **Open User 2 (Bob)**:
   - Open an **Incognito** window or a different browser (e.g. Chrome + Edge).
   - Navigate to `http://localhost:5173`.
   - Enter name `Bob`, select **Emerald Green**, and click **Enter Virtual Office**.
3. **Walk Within Earshot (<100px)**:
   - Use `W`, `A`, `S`, `D` or click on the canvas to walk Alice closer to Bob.
   - When distance $\le 100\text{px}$, a glowing **green acoustic connection beam** connects them.
   - A toast notification will confirm: **"🎙️ Bob is within earshot! Audio connected."**
   - The WebRTC peer connection automatically negotiates in the background.
4. **Test Dynamic Volume**:
   - Speak into Alice's microphone. As Alice walks closer (e.g., 20px), Bob hears Alice loudly.
   - As Alice walks farther away (e.g., 85px), Alice's voice becomes quiet.
5. **Test 3D Stereo Panning**:
   - Position Alice to the **left** of Bob $\rightarrow$ Bob hears Alice primarily in his **left ear**.
   - Position Alice to the **right** of Bob $\rightarrow$ Bob hears Alice primarily in his **right ear**.
6. **Test Acoustic Sound Obstacles**:
   - Walk Alice inside **Conference Room A** behind the glass wall $\rightarrow$ the connection beam turns **amber**, and Alice's voice is muffled by the low-pass acoustic filter (65% volume reduction).
   - Walk Alice into the **Private Phone Booth** $\rightarrow$ the connection beam turns **red (dashed)**, and sound is completely blocked (100% soundproof).
7. **Test Connection Teardown**:
   - Walk Alice away beyond 100px $\rightarrow$ the WebRTC peer connection cleanly closes.

### Built-in Diagnostics Synthesizer
Click the **Activity Icon** in the bottom controls dock to open the **Diagnostics Suite**:
- Click **Left Ear (-1.0)**, **Center (0.0)**, or **Right Ear (+1.0)** to test stereo channels without a second person.
- Click **Play 360° Left-to-Right Stereo Sweep** to hear a sound orbit around your head.
- Run the **Live Spatial Benchmark** directly in the UI.

---

## 📡 API & WebSocket Event Reference

### REST Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server uptime, database status, and configuration |
| `GET` | `/api/rooms` | Retrieve all office rooms and layouts |
| `GET` | `/api/rooms/:roomId` | Get specific room dimensions and sound obstacles |
| `POST` | `/api/rooms/:roomId/obstacles` | Add a sound-blocking obstacle to an office |
| `POST` | `/api/spatial/nearby` | Query avatars within radius using MongoDB `$near` index |
| `GET` | `/api/spatial/clusters` | Get conversation clusters in a room |
| `GET` | `/api/spatial/audit` | Execute the automated <20ms latency benchmark |
| `POST` | `/api/spatial/occlusion` | Test acoustic ray occlusion between two coordinates |

### WebSocket Events
| Event | Direction | Payload | Description |
| :--- | :---: | :--- | :--- |
| `join-room` | Client $\rightarrow$ Server | `{ roomId, username, avatarColor, x, y }` | User enters office space |
| `room-state` | Server $\rightarrow$ Client | `{ room, self, peers }` | Office layout and avatar roster |
| `player-move` | Client $\rightarrow$ Server | `{ x, y, roomId }` | Updates avatar coordinates |
| `player-moved` | Server $\rightarrow$ Client | `{ userId, x, y, username, avatarColor }` | Real-time position broadcast |
| `peer-entered-earshot` | Server $\rightarrow$ Client | `{ peerId, peerSocketId, distance, isInitiator }` | Triggers WebRTC connection handshake |
| `peer-left-earshot` | Server $\rightarrow$ Client | `{ peerId }` | Triggers WebRTC connection closure |
| `webrtc-offer` | Bidirectional | `{ targetSocketId, targetUserId, offer }` | SDP Offer (proximity-guarded $\le 100$px) |
| `webrtc-answer` | Bidirectional | `{ targetSocketId, targetUserId, answer }` | SDP Answer (proximity-guarded $\le 100$px) |
| `webrtc-ice-candidate` | Bidirectional | `{ targetSocketId, candidate }` | ICE Candidate routing |
| `update-audio-state` | Client $\rightarrow$ Server | `{ isMuted, isDeafened }` | Toggles microphone or deafen status |

---

## 📄 License
ISC License. Built for the Infotact ProxiSpeak Internship Project.