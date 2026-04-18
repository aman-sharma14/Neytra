/**
 * VoiceCommandEcho.jsx — Shows what the system heard + action confirmation.
 *
 * Props:
 *   transcript  string — raw voice input (interim or final)
 *   confirmation string | null — "Understood: ..." message
 *
 * Member B owns this file.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Mic } from 'lucide-react'

export default function VoiceCommandEcho({ transcript, confirmation }) {
  return (
    <div
      id="voice-echo"
      className="glass-card"
      style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
        LAST HEARD
      </div>

      {/* Transcript */}
      <AnimatePresence mode="wait">
        {transcript ? (
          <motion.div
            key={transcript}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '1rem',
              color: 'var(--text-primary)',
              fontStyle: 'italic',
            }}
          >
            <Mic size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
            <span>"{transcript}"</span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}
          >
            Say something…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation */}
      <AnimatePresence>
        {confirmation && (
          <motion.div
            key={confirmation}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: '0.85rem',
              color: 'var(--accent-blue-bright)',
              fontWeight: 500,
            }}
          >
            {confirmation}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
