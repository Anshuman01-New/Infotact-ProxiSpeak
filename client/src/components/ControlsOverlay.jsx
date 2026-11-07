/**
 * ProxiSpeak - Controls Overlay Component
 *
 * Bottom-center floating action dock. Responsibilities:
 *  - Mic mute / unmute with real-time level bar
 *  - Deafen toggle
 *  - Test tone broadcast (WebRTC audio verification)
 *  - Movement hint label
 *
 * NOTE: Earshot ring / radar / roster / diagnostics toggles live in
 * the unified top header bar (App.jsx) to avoid any overlap.
 */

import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Music } from 'lucide-react';

export default function ControlsOverlay({
  isMuted,
  isDeafened,
  micVolume = 0,
  isSpeaking = false,
  isBroadcastingTone = false,
  onToggleMute,
  onToggleDeafen,
  onToggleBroadcastTone,
}) {
  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-auto select-none">

      {/* ── Main Action Dock ── */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl border border-white/8"
        style={{
          background: 'rgba(10, 15, 30, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05) inset',
        }}
      >
        {/* ─ Mic Button ─ */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isMuted
              ? 'bg-rose-600/25 text-rose-300 border border-rose-500/40 hover:bg-rose-600/35'
              : isSpeaking
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 shadow-sm shadow-emerald-500/20'
              : 'bg-emerald-700/20 text-emerald-300 border border-emerald-600/35 hover:bg-emerald-600/25'
          }`}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Mic On'}</span>

          {/* Mic level bar */}
          {!isMuted && (
            <div className="w-1.5 h-5 bg-slate-800/80 rounded-full overflow-hidden flex flex-col justify-end">
              <div
                className="w-full rounded-full transition-all duration-75"
                style={{
                  height: `${Math.round(micVolume * 100)}%`,
                  backgroundColor: micVolume > 0.6 ? '#F87171' : micVolume > 0.3 ? '#FCD34D' : '#34D399',
                }}
              />
            </div>
          )}
        </button>

        {/* ─ Separator ─ */}
        <div className="h-6 w-px bg-white/8" />

        {/* ─ Deafen Button ─ */}
        <button
          onClick={onToggleDeafen}
          title={isDeafened ? 'Undeafen' : 'Deafen (mute all incoming audio)'}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isDeafened
              ? 'bg-amber-600/25 text-amber-200 border border-amber-500/40 hover:bg-amber-600/35'
              : 'bg-slate-800/60 text-slate-300 border border-slate-700/40 hover:bg-slate-700/60'
          }`}
        >
          {isDeafened ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <span className="hidden sm:inline">{isDeafened ? 'Deafened' : 'Hearing'}</span>
        </button>

        {/* ─ Separator ─ */}
        <div className="h-6 w-px bg-white/8" />

        {/* ─ Broadcast Test Tone ─ */}
        <button
          onClick={onToggleBroadcastTone}
          title="Send test audio tone via WebRTC to verify connection"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isBroadcastingTone
              ? 'bg-purple-600/35 text-purple-100 border border-purple-500/60 animate-pulse shadow-sm shadow-purple-500/30'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:bg-slate-700/60 hover:text-slate-200'
          }`}
        >
          <Music size={15} />
          <span className="hidden md:inline text-xs">
            {isBroadcastingTone ? 'Tone Active' : 'Test Sound'}
          </span>
        </button>
      </div>

      {/* ── Movement Hint (non-interactive caption) ── */}
      <div className="text-[11px] text-slate-500 font-medium px-3 py-1 rounded-full pointer-events-none select-none flex items-center gap-1">
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-300 font-mono text-[10px] border border-slate-700/50">W</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-300 font-mono text-[10px] border border-slate-700/50">A</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-300 font-mono text-[10px] border border-slate-700/50">S</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-300 font-mono text-[10px] border border-slate-700/50">D</kbd>
        <span className="ml-1">or click to walk</span>
      </div>
    </div>
  );
}
