/**
 * ProxiSpeak - Spatial Proximity Radar HUD
 *
 * Positioned: bottom-right, `bottom: 110px` to clear the controls dock.
 * Never overlaps the header, user list drawer, or controls dock.
 *
 * Shows:
 *  - 100px earshot perimeter ring
 *  - Relative peer angles and distances as blips
 *  - Rotating sweep line
 *  - Peers-in-range badge + close button
 */

import React, { useRef, useEffect } from 'react';
import { CONFIG } from '../config';
import { calculateDistance } from '../utils/geometry';
import { X } from 'lucide-react';

export default function SpatialRadar({ self, peers = [], onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !self) return;
    const ctx = canvas.getContext('2d');
    const size = 160;
    const center = size / 2;
    const radarRadius = 65; // represents 100px earshot

    let animId;
    let sweepAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // Dark glass background (clipped circle)
      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, radarRadius + 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(5, 10, 24, 0.95)';
      ctx.fill();
      ctx.clip();

      // Grid rings
      [radarRadius, radarRadius / 2].forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(center, center, r, 0, Math.PI * 2);
        ctx.strokeStyle = i === 0 ? 'rgba(56, 189, 248, 0.40)' : 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Crosshair lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(center - radarRadius, center); ctx.lineTo(center + radarRadius, center);
      ctx.moveTo(center, center - radarRadius); ctx.lineTo(center, center + radarRadius);
      ctx.stroke();

      // Rotating sweep
      sweepAngle = (sweepAngle + 0.03) % (Math.PI * 2);

      // Sweep gradient trail
      const gradient = ctx.createConicalGradient
        ? undefined
        : null; // Fallback: just a line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(
        center + Math.cos(sweepAngle) * radarRadius,
        center + Math.sin(sweepAngle) * radarRadius
      );
      ctx.stroke();

      // Self dot
      ctx.fillStyle = self.avatarColor || '#3B82F6';
      ctx.beginPath();
      ctx.arc(center, center, 4, 0, Math.PI * 2);
      ctx.fill();
      // Self glow ring
      ctx.strokeStyle = `${self.avatarColor || '#3B82F6'}88`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(center, center, 7, 0, Math.PI * 2);
      ctx.stroke();

      // Peer blips
      for (const peer of peers) {
        const dist = calculateDistance(self.x, self.y, peer.x, peer.y);
        const scale = radarRadius / CONFIG.DEFAULT_EARSHOT_RADIUS;
        const rx = center + (peer.x - self.x) * scale;
        const ry = center + (peer.y - self.y) * scale;

        // Only draw if visible in radar bounds
        const blipDist = Math.hypot(rx - center, ry - center);
        if (blipDist > radarRadius + 4) continue;

        const inEarshot = dist <= CONFIG.DEFAULT_EARSHOT_RADIUS;
        const color = inEarshot ? (peer.avatarColor || '#10B981') : '#475569';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(rx, ry, inEarshot ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (inEarshot) {
          ctx.strokeStyle = `${color}99`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rx, ry, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();

      // Outer ring border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(center, center, radarRadius + 10, 0, Math.PI * 2);
      ctx.stroke();

      // Cardinal labels — outside the clip
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↑', center, center - radarRadius - 2);
      ctx.fillText('L', center - radarRadius - 2, center);
      ctx.fillText('R', center + radarRadius + 2, center);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [self, peers]);

  const peersInEarshot = peers.filter(
    (p) => calculateDistance(self.x, self.y, p.x, p.y) <= CONFIG.DEFAULT_EARSHOT_RADIUS
  );

  return (
    <div
      className="absolute right-5 z-25 pointer-events-auto"
      style={{ bottom: '108px' }}  /* sits above the controls dock (≈88px) + gap */
    >
      <div
        className="rounded-2xl p-3 shadow-2xl border border-slate-700/50 flex flex-col items-center gap-1.5"
        style={{
          background: 'rgba(8, 14, 32, 0.90)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between w-full px-0.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Radar</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
              peersInEarshot.length > 0
                ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50'
                : 'bg-slate-800/60 text-slate-500 border-slate-700/50'
            }`}>
              {peersInEarshot.length} in range
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-200 p-0.5 rounded transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <canvas ref={canvasRef} width={160} height={160} className="rounded-full" />

        {/* Footer label */}
        <div className="text-[9px] text-slate-600 font-mono tracking-wider">
          {CONFIG.DEFAULT_EARSHOT_RADIUS}px earshot
        </div>
      </div>
    </div>
  );
}
