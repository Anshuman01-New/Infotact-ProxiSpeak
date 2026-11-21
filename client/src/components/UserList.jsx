/**
 * ProxiSpeak - Active Users & Spatial Audio Telemetry Drawer
 */

import React from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Navigation, UserCheck, Radio } from 'lucide-react';
import { calculateDistance, calculateStereoPan, calculateDistanceGain } from '../utils/geometry';
import { CONFIG } from '../config';
import { getInitials } from '../utils/colors';

export default function UserList({
  isOpen,
  onClose,
  self,
  peers = [],
  onNavigateToUser,
}) {
  if (!isOpen) return null;

  // Split peers into earshot vs out-of-range
  const peersWithSpatial = peers.map((peer) => {
    const distance = Math.round(calculateDistance(self.x, self.y, peer.x, peer.y));
    const inEarshot = distance <= CONFIG.DEFAULT_EARSHOT_RADIUS;
    const { pan } = calculateStereoPan(self.x, self.y, peer.x, peer.y, CONFIG.DEFAULT_EARSHOT_RADIUS);
    const gain = calculateDistanceGain(distance, CONFIG.DEFAULT_EARSHOT_RADIUS);

    return {
      ...peer,
      distance,
      inEarshot,
      pan: Math.round(pan * 100) / 100,
      gainPercent: Math.round(gain * 100),
    };
  });

  const inEarshotPeers = peersWithSpatial.filter((p) => p.inEarshot);
  const outOfEarshotPeers = peersWithSpatial.filter((p) => !p.inEarshot);

  return (
    <div className="fixed inset-y-0 right-0 w-80 max-w-full bg-slate-900/97 backdrop-blur-2xl border-l border-slate-800/70 shadow-2xl flex flex-col z-40 pointer-events-auto animate-slide-in-right pt-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 px-5">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <span>Office Directory</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
              {peers.length + 1}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active avatars in this virtual space
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-5 space-y-5">
        {/* Self Section */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Your Avatar
          </div>
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-md ring-2 ring-white/10"
                style={{ backgroundColor: self.avatarColor || '#3B82F6' }}
              >
                {getInitials(self.username)}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100 flex items-center space-x-1.5">
                  <span>{self.username}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">You</span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  ({Math.round(self.x)}, {Math.round(self.y)})
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-slate-400">
              {self.isMuted ? (
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300"><MicOff size={15} /></div>
              ) : (
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300"><Mic size={15} /></div>
              )}
              {self.isDeafened && (
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300"><VolumeX size={15} /></div>
              )}
            </div>
          </div>
        </div>

        {/* Within Earshot Section */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Within Earshot ({inEarshotPeers.length})</span>
            </span>
            <span className="text-[10px] text-emerald-400/80 font-mono">Audio Active</span>
          </div>

          {inEarshotPeers.length === 0 ? (
            <div className="text-xs text-slate-400 p-4 bg-slate-800/40 border border-slate-800 rounded-2xl text-center leading-relaxed">
              No colleagues within 100px.<br />
              <span className="text-slate-500 text-[11px]">Walk closer to any avatar to start hearing them.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {inEarshotPeers.map((peer) => (
                <div
                  key={peer.userId}
                  className="bg-emerald-950/30 border border-emerald-600/40 rounded-2xl p-3.5 flex flex-col space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow ring-2 ring-emerald-500/30"
                        style={{ backgroundColor: peer.avatarColor || '#10B981' }}
                      >
                        {getInitials(peer.username)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-100">{peer.username}</div>
                        <div className="text-xs text-emerald-300 font-mono flex items-center space-x-1">
                          <span>{peer.distance}px away</span>
                          <span>•</span>
                          <span>{peer.gainPercent}% volume</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateToUser(peer.x, peer.y)}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                      title="Walk directly to this colleague"
                    >
                      <Navigation size={15} />
                    </button>
                  </div>

                  {/* Stereo Panning Visualizer */}
                  <div className="bg-slate-900/80 rounded-xl p-2.5 text-xs font-mono space-y-1.5 border border-slate-800">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>L</span>
                      <span className="text-slate-300 font-medium">
                        {peer.pan < -0.15
                          ? `Panned Left (${Math.round(Math.abs(peer.pan) * 100)}%)`
                          : peer.pan > 0.15
                          ? `Panned Right (${Math.round(peer.pan * 100)}%)`
                          : 'Centered (0.0)'}
                      </span>
                      <span>R</span>
                    </div>

                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden relative">
                      <div
                        className="absolute top-0 bottom-0 bg-blue-400 rounded-full transition-all duration-100 shadow-sm"
                        style={{
                          left: `${50 + (peer.pan * 45) - 6}%`,
                          width: '12%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outside Earshot Section */}
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Outside Earshot ({outOfEarshotPeers.length})
          </div>

          {outOfEarshotPeers.length === 0 ? (
            <div className="text-xs text-slate-500 italic p-3 text-center">
              All colleagues are within earshot.
            </div>
          ) : (
            <div className="space-y-2">
              {outOfEarshotPeers.map((peer) => (
                <div
                  key={peer.userId}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-3 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white opacity-80"
                      style={{ backgroundColor: peer.avatarColor || '#64748B' }}
                    >
                      {getInitials(peer.username)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{peer.username}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {peer.distance}px away (&gt;100px)
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigateToUser(peer.x, peer.y)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-blue-600/30 hover:text-blue-300 text-xs text-slate-300 transition-all"
                    title="Walk over to join conversation"
                  >
                    <Navigation size={12} />
                    <span>Walk to</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
