/**
 * StatusBar.jsx — Top status bar: logo, live indicator, mic status, memory label.
 *
 * Props:
 *   isNarrating  boolean
 *   isListening  boolean
 *   activeMemory string | null  — active location name or null
 *
 * Member B owns this file.
 */

import { Mic, MicOff, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function StatusBar({ isNarrating, isListening, activeMemory, useNIM, onToggleNIM }) {
  return (
    <header
      id="status-bar"
      className="flex items-center justify-between px-5 py-3 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.4rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}
        >
          N<span style={{ color: 'var(--accent-blue)' }}>eytra</span>
        </span>

        {/* Live dot */}
        <div className="flex items-center gap-2">
          <span
            className={`status-dot ${isNarrating ? 'active' : 'inactive'}`}
          />
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: isNarrating ? 'var(--accent-green)' : 'var(--text-muted)',
            }}
          >
            {isNarrating ? 'LIVE' : 'PAUSED'}
          </span>
        </div>
      </div>

      {/* Center NIM Toggle */}
      <div className="flex items-center gap-2" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
        <span style={{ color: useNIM ? 'var(--text-muted)' : 'var(--accent-blue)' }}>Gemini</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={useNIM} onChange={onToggleNIM} />
          <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
        </label>
        <span style={{ color: useNIM ? 'var(--accent-green)' : 'var(--text-muted)' }}>Nvidia NIM</span>
      </div>

      {/* Right side: memory + mic */}
      <div className="flex items-center gap-4">
        {/* Active memory indicator */}
        <AnimatePresence>
          {activeMemory && (
            <motion.div
              key={activeMemory}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-1.5"
              style={{ fontSize: '0.78rem', color: 'var(--accent-amber)' }}
            >
              <MapPin size={13} />
              <span>Memory: {activeMemory}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic indicator */}
        <div
          id="mic-indicator"
          className={`flex items-center gap-1.5 ${isListening ? 'mic-listening' : 'mic-idle'}`}
          style={{ fontSize: '0.78rem', fontWeight: 500 }}
        >
          {isListening ? <Mic size={16} /> : <MicOff size={16} />}
          <span>{isListening ? 'MIC ON' : 'MIC OFF'}</span>
        </div>
      </div>
    </header>
  )
}
