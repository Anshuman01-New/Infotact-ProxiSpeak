/**
 * ProxiSpeak - Join Virtual Office Modal
 *
 * Polished onboarding screen with:
 * - Avatar color & initials live preview with glowing aura
 * - Strict keyboard isolation (prevents WASD key interception while typing)
 * - Auto-focus on input field
 * - Random name suggestion across sessions to facilitate multi-browser testing
 * - Ultra-modern glassmorphic design
 */

import React, { useState, useEffect, useRef } from 'react';
import { AVATAR_COLORS, getInitials } from '../utils/colors';
import { Sparkles, MapPin, ArrowRight, Headphones, Volume2, Shield } from 'lucide-react';

const SUGGESTED_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Elena', 'Felix', 'Grace'];

export default function JoinModal({ isOpen, onJoin }) {
  const [username, setUsername] = useState(() => {
    // Pick a random default name to simplify testing across two tabs
    const randomIndex = Math.floor(Math.random() * SUGGESTED_NAMES.length);
    return SUGGESTED_NAMES[randomIndex];
  });
  const [avatarColor, setAvatarColor] = useState(() => {
    const randomIndex = Math.floor(Math.random() * AVATAR_COLORS.length);
    return AVATAR_COLORS[randomIndex];
  });
  const [roomId, setRoomId] = useState('default-office');
  const inputRef = useRef(null);

  // Auto-focus username input on mount
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Strictly prevent any keydown/keyup from bubbling to window or canvas
  const handleKeyIsolation = (e) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    onJoin({
      username: username.trim(),
      avatarColor,
      roomId: roomId.trim() || 'default-office',
    });
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4  z-50 overflow-y-auto"
      onKeyDown={handleKeyIsolation}
      onKeyUp={handleKeyIsolation}
      onKeyPress={handleKeyIsolation}
    >
      <div className="relative bg-slate-900/95 border border-white/10 rounded-3xl max-w-md w-full p-20 shadow-2xl shadow-blue-950/50 overflow-hidden">
        {/* Dynamic Ambient Background Glow */}
        <div
          className="absolute -top-24 -left-24 w-60 h-60 rounded-full blur-3xl opacity-30 pointer-events-none transition-colors duration-500"
          style={{ backgroundColor: avatarColor }}
        />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none bg-indigo-500" />

        {/* Header Badge & Title */}
        <div className="text-center mb-6 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold mb-3.5 shadow-sm">
            <Sparkles size={14} className="text-blue-400" />
            <span>Infotact ProxiSpeak • 3D Spatial Audio</span>
          </div>

          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Join Virtual Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-sm mx-auto">
            Experience organic spatial communication. Colleagues become audible and directional as you walk within the 100px earshot circle.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          {/* Avatar Preview with Glowing Halos */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div
                className="absolute inset-0 rounded-full blur-md opacity-60 transition-all duration-300"
                style={{ backgroundColor: avatarColor }}
              />
              <div
                className="relative w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-2xl border-4 border-slate-900 transition-all duration-300 transform group-hover:scale-105"
                style={{ backgroundColor: avatarColor }}
              >
                {getInitials(username) || '?'}
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-2.5">
              Live Avatar Preview
            </span>
          </div>

          {/* Color Palette Picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Choose Color Theme
            </label>
            <div className="flex justify-center flex-wrap gap-2.5">
              {AVATAR_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className={`w-7 h-7 rounded-full transition-all duration-200 ${
                    avatarColor === color
                      ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-lg'
                      : 'hover:scale-110 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                  title={`Color: ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Username Input with Keyboard Isolation & autoFocus */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Your Display Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyIsolation}
              onKeyUp={handleKeyIsolation}
              onKeyPress={handleKeyIsolation}
              placeholder="e.g. Alice / Alex"
              required
              maxLength={20}
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner transition-all font-medium"
            />
          </div>

          {/* Floor / Room Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
              <MapPin size={13} className="text-blue-400" />
              <span>Office Floor</span>
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={handleKeyIsolation}
              onKeyUp={handleKeyIsolation}
              onKeyPress={handleKeyIsolation}
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-inner transition-all cursor-pointer font-medium"
            >
              <option value="default-office">Infotact Headquarters — Floor 1 (Standard)</option>
              <option value="open-collaboration">Open Innovation Hub</option>
              <option value="executive-suite">Executive Boardroom & Suites</option>
            </select>
          </div>

          {/* Audio Advice Note */}
          <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-slate-400">
            <Headphones size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="leading-snug">
              <strong className="text-slate-200">Headphones recommended:</strong> ProxiSpeak utilizes dynamic proximity volume attenuation and 3D stereo panning based on avatar distance and orientation.
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm py-3.5 rounded-xl shadow-xl shadow-blue-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-2"
          >
            <span>Enter Virtual Office</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
