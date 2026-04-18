/**
 * NarrationPanel.jsx — Displays current and previous narration with typewriter effect.
 *
 * Props:
 *   current   string — current narration text
 *   previous  string — previous narration (shown faded)
 *
 * Current narration renders word-by-word as a typewriter effect
 * triggered whenever `current` changes.
 *
 * Member B owns this file.
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'

const WORD_DELAY_MS = 80  // milliseconds per word

export default function NarrationPanel({ current, previous }) {
  const [displayedWords, setDisplayedWords] = useState([])
  const timerRef = useRef(null)

  // Typewriter effect: reveal one word at a time
  useEffect(() => {
    if (!current) {
      setDisplayedWords([])
      return
    }

    clearInterval(timerRef.current)
    setDisplayedWords([])

    const words = current.split(' ')
    let idx = 0

    timerRef.current = setInterval(() => {
      idx++
      setDisplayedWords(words.slice(0, idx))
      if (idx >= words.length) clearInterval(timerRef.current)
    }, WORD_DELAY_MS)

    return () => clearInterval(timerRef.current)
  }, [current])

  return (
    <div
      id="narration-panel"
      className="glass-card"
      style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em' }}>
        <Volume2 size={13} />
        NARRATION
      </div>

      {/* Current — typewriter */}
      <div className="narration-current" style={{ minHeight: '2.4em' }}>
        <AnimatePresence mode="wait">
          {displayedWords.length > 0 ? (
            <motion.span
              key={current}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {displayedWords.map((word, i) => (
                <motion.span
                  key={`${word}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'inline-block', marginRight: '0.28em' }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.span>
          ) : (
            <motion.span
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '1rem' }}
            >
              Waiting for scene…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Previous — faded */}
      {previous && (
        <div className="narration-prev">
          {previous}
        </div>
      )}
    </div>
  )
}
