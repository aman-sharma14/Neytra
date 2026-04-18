/**
 * useVoiceSpeech.js — Browser speechSynthesis queue with priority.
 *
 * Priority levels (lower number = higher priority):
 *   0 — hazard alert (interrupts everything)
 *   1 — face announcement
 *   2 — narration / command response
 *
 * Provides:
 *   speak(text, priority, rate, pitch) — enqueue an utterance
 *   stop()   — cancel all speech
 *   speaking — boolean
 *
 * Member B owns this file.
 */

import { useRef, useState, useCallback } from 'react'

const INTER_UTTERANCE_GAP_MS = 600

export function useVoiceSpeech() {
  const queueRef = useRef([])  // [{ text, priority, rate, pitch }]
  const [speaking, setSpeaking] = useState(false)
  const processingRef = useRef(false)

  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) return

    // Sort by priority (ascending = higher priority first)
    queueRef.current.sort((a, b) => a.priority - b.priority)
    const { text, rate = 1, pitch = 1 } = queueRef.current.shift()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.lang = 'en-US'

    // Prefer a natural English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
    ) || voices.find(v => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    processingRef.current = true
    setSpeaking(true)

    utterance.onend = () => {
      setTimeout(() => {
        processingRef.current = false
        if (queueRef.current.length === 0) setSpeaking(false)
        processQueue()
      }, INTER_UTTERANCE_GAP_MS)
    }

    utterance.onerror = () => {
      processingRef.current = false
      setSpeaking(false)
    }

    window.speechSynthesis.speak(utterance)
  }, [])

  const speak = useCallback((text, priority = 2, rate = 1, pitch = 1) => {
    if (!text?.trim()) return

    if (priority === 0) {
      // Hazard: cancel everything and speak immediately
      window.speechSynthesis.cancel()
      queueRef.current = []
      processingRef.current = false
    }

    queueRef.current.push({ text: text.trim(), priority, rate, pitch })
    processQueue()
  }, [processQueue])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    queueRef.current = []
    processingRef.current = false
    setSpeaking(false)
  }, [])

  return { speak, stop, speaking }
}
