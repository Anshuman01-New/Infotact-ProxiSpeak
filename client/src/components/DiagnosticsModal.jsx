/**
 * ProxiSpeak - Diagnostics & Audio Spatializer Modal
 *
 * Implements Week 2 Audio Check & Spatial Audit verification:
 * - Spatial Audio Test Synthesizer: Left, Center, Right, 360-degree orbit sweep
 * - Proximity Distance Attenuation Audio Preview (25px, 50px, 75px, 95px)
 * - Live MongoDB Geospatial Benchmark Latency Check (<20ms target)
 */

import React, { useState } from 'react';
import { X, Volume2, Activity, Play, CheckCircle2, AlertTriangle, Headphones, Server } from 'lucide-react';
import { spatialAudioService } from '../services/spatialAudioService';
import { CONFIG } from '../config';

export default function DiagnosticsModal({ isOpen, onClose }) {
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [isPlayingOrbit, setIsPlayingOrbit] = useState(false);

  if (!isOpen) return null;

  // Test Left Stereo Pan
  const testLeftPan = () => {
    spatialAudioService.playSpatialTestTone({ pan: -1.0, gain: 0.6, frequency: 440 });
  };

  // Test Center Stereo Pan
  const testCenterPan = () => {
    spatialAudioService.playSpatialTestTone({ pan: 0.0, gain: 0.6, frequency: 520 });
  };

  // Test Right Stereo Pan
  const testRightPan = () => {
    spatialAudioService.playSpatialTestTone({ pan: 1.0, gain: 0.6, frequency: 660 });
  };

  // Test Distance Gain Attenuation
  const testDistanceGain = (distancePx) => {
    // Dropoff formula: 1 - (d/R)^1.5
    const ratio = distancePx / 100;
    const gain = Math.max(0.05, 1.0 - Math.pow(ratio, 1.5));
    spatialAudioService.playSpatialTestTone({ pan: 0.0, gain, frequency: 480, duration: 0.8 });
  };

  // 360 Orbit Sound Test (Sweeps from full left to full right)
  const testOrbitSweep = async () => {
    if (isPlayingOrbit) return;
    setIsPlayingOrbit(true);

    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      // Pan from -1.0 to +1.0
      const pan = -1.0 + (i / steps) * 2.0;
      spatialAudioService.playSpatialTestTone({
        pan,
        gain: 0.5,
        frequency: 400 + i * 25,
        duration: 0.15,
      });
      await new Promise((r) => setTimeout(r, 160));
    }

    setIsPlayingOrbit(false);
  };

  // Run Backend Spatial Audit Benchmark
  const runBackendAudit = async () => {
    setAuditLoading(true);
    setAuditResult(null);

    try {
      const response = await fetch(`${CONFIG.SERVER_URL}/api/spatial/audit?users=50&queries=50`);
      const data = await response.json();
      setAuditResult(data.audit);
    } catch (err) {
      setAuditResult({ error: err.message });
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-lg flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900/98 border border-slate-700/60 rounded-2xl max-w-xl w-full p-6 shadow-2xl shadow-black/60 relative max-h-[85vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-5">
          <div className="flex items-center space-x-2.5">
            <Activity className="text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-slate-100">
              Audio & Spatial Engine Diagnostics
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Section 1: 3D Stereo Panning Test */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Headphones size={14} className="text-blue-400" />
              <span>3D Stereo Audio Panning (Week 4 Specification)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Verify your headphones and stereo separation. The audio will pan dynamically based on avatar direction:
            </p>

            <div className="grid grid-cols-3 gap-2.5 mb-2.5">
              <button
                onClick={testLeftPan}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl p-3 text-center transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300">
                  Left Ear
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Pan: -1.0</div>
              </button>

              <button
                onClick={testCenterPan}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl p-3 text-center transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300">
                  Center
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Pan: 0.0</div>
              </button>

              <button
                onClick={testRightPan}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl p-3 text-center transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300">
                  Right Ear
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Pan: +1.0</div>
              </button>
            </div>

            <button
              onClick={testOrbitSweep}
              disabled={isPlayingOrbit}
              className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-xl py-2 px-3 text-xs font-medium flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Play size={13} />
              <span>{isPlayingOrbit ? 'Playing 360° Orbit...' : 'Play 360° Left-to-Right Stereo Sweep'}</span>
            </button>
          </div>

          {/* Section 2: Dynamic Distance Attenuation */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Volume2 size={14} className="text-emerald-400" />
              <span>Dynamic Volume Drop-Off (Week 3 Specification)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Volume smoothly decreases with Euclidean pixel distance and approaches near-silent at the 100px earshot edge:
            </p>

            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => testDistanceGain(20)}
                className="bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 text-center transition-all"
              >
                <div className="text-xs font-semibold text-emerald-400">20 px</div>
                <div className="text-[10px] text-slate-400">Very Loud</div>
              </button>

              <button
                onClick={() => testDistanceGain(50)}
                className="bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 text-center transition-all"
              >
                <div className="text-xs font-semibold text-blue-400">50 px</div>
                <div className="text-[10px] text-slate-400">Moderate</div>
              </button>

              <button
                onClick={() => testDistanceGain(75)}
                className="bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 text-center transition-all"
              >
                <div className="text-xs font-semibold text-amber-400">75 px</div>
                <div className="text-[10px] text-slate-400">Quiet</div>
              </button>

              <button
                onClick={() => testDistanceGain(95)}
                className="bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl p-2.5 text-center transition-all"
              >
                <div className="text-xs font-semibold text-rose-400">95 px</div>
                <div className="text-[10px] text-slate-400">Faint Edge</div>
              </button>
            </div>
          </div>

          {/* Section 3: Spatial Audit & Latency Benchmark */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Server size={14} className="text-purple-400" />
              <span>MongoDB Spatial Audit Benchmark (&lt;20ms Target)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Week 2 Requirement: Prove backend filters and clusters users based on geospatial coordinates under 20ms:
            </p>

            <button
              onClick={runBackendAudit}
              disabled={auditLoading}
              className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl py-2 px-3.5 text-xs font-medium flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Activity size={14} className={auditLoading ? 'animate-spin' : ''} />
              <span>{auditLoading ? 'Executing 50 Spatial Queries...' : 'Run Live Spatial Benchmark'}</span>
            </button>

            {auditResult && !auditResult.error && (
              <div className="mt-3 bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-xs font-mono space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                  <CheckCircle2 size={15} />
                  <span>{auditResult.auditAssessment}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1 text-[11px]">
                  <div>P95 Latency: <span className="text-emerald-300 font-bold">{auditResult.metrics.p95LatencyMs} ms</span> (&lt;20ms)</div>
                  <div>Average: <span className="text-blue-300 font-bold">{auditResult.metrics.avgLatencyMs} ms</span></div>
                  <div>Min: <span className="text-slate-400">{auditResult.metrics.minLatencyMs} ms</span></div>
                  <div>Clustering: <span className="text-purple-300">{auditResult.metrics.clusteringLatencyMs} ms</span></div>
                </div>
              </div>
            )}

            {auditResult && auditResult.error && (
              <div className="mt-3 bg-rose-950/30 border border-rose-800/50 rounded-xl p-3 text-xs text-rose-300 flex items-center space-x-2">
                <AlertTriangle size={15} />
                <span>Benchmark failed: {auditResult.error}. Make sure the server is running on port 5000.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
