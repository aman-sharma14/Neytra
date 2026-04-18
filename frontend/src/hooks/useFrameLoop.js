/**
 * useFrameLoop.js — Unified scan loop: YOLO labels + conditional face recognition.
 *
 * Replaces the old dual-loop architecture (separate scene + face polling).
 * Now calls POST /scan which returns:
 *   - labels: short spatial string ("bike on left, person ahead")
 *   - hazard / hazard_type
 *   - faces: recognized face data (only when person detected)
 *   - person_detected: boolean
 *
 * Full Gemini scene analysis is triggered on-demand via POST /scene
 * (handled by App.jsx when user says "describe" / "analyze").
 *
 * Member B owns this file.
 */

import { useRef, useState, useCallback } from 'react'
import { postScan } from '../api/neytraApi'

const SCAN_INTERVAL_MS = 2000   // 2-second continuous scan cycle

export function useFrameLoop() {
  const timerRef = useRef(null)
  const isBusyRef = useRef(false)
  const [isRunning, setIsRunning] = useState(false)
  const lastLabelsRef = useRef('')   // deduplicate unchanged labels

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRunning(false)
  }, [])

  const start = useCallback((captureFrame, onResult) => {
    stop()
    lastLabelsRef.current = ''

    let isExecuting = false

    const tick = async () => {
      if (isBusyRef.current || isExecuting) return

      const frame = captureFrame()
      if (!frame) return

      isExecuting = true
      try {
        const result = await postScan(frame)

        if (result && !result.error) {
          const newLabels = (result.labels || '').trim().toLowerCase()
          const oldLabels = lastLabelsRef.current.trim().toLowerCase()

          // Deduplicate: skip if labels haven't changed
          const labelsChanged = newLabels !== oldLabels
                                && newLabels !== 'path clear'
                                || oldLabels === ''  // always fire the first one

          if (labelsChanged || result.hazard) {
            lastLabelsRef.current = result.labels || ''
          }

          // Always pass to App — it decides what to speak
          onResult({
            ...result,
            labelsChanged,
          })
        }
      } catch (err) {
        console.warn('[useFrameLoop] /scan error:', err.message)
        onResult({ error: err.message })
      } finally {
        isExecuting = false
      }
    }

    // First tick immediately, then every interval
    tick()
    timerRef.current = setInterval(tick, SCAN_INTERVAL_MS)
    setIsRunning(true)
  }, [stop])

  /** Call setBusy(true) while handling a voice command to pause scan. */
  const setBusy = useCallback((busy) => {
    isBusyRef.current = busy
  }, [])

  return { start, stop, isRunning, setBusy }
}
