# ProxiSpeak: Scaling & WebRTC Optimization Guide

This document details the architectural blueprints and implementation roadmap for:
1. **Optimizing the WebRTC Mesh Network** (Transitioning from full $O(N^2)$ mesh to an optimized Selective Proximity Mesh).
2. **Horizontal Scaling via Redis Pub/Sub** (Scaling Socket.io across multiple Node.js instances behind a load balancer with sticky sessions and distributed geospatial state).

---

## 1. The Challenge: Scaling to 50+ Concurrent Users

The ProxiSpeak project specification defines a target of **50+ concurrent users in the same virtual office**.

In conventional video conferencing platforms (Zoom, Google Meet), all audio is sent to a central server that mixes or selectively forwards audio. In a pure peer-to-peer (P2P) WebRTC architecture, scaling breaks down exponentially if all users connect to each other simultaneously.

Simultaneously, a single Node.js process runs on a single event-loop thread. As the number of WebSocket connections and movement broadcasts grows, a single instance will bottleneck on CPU.

Below is how ProxiSpeak solves both problems.

---