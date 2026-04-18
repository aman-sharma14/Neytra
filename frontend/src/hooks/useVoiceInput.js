/**
 * useVoiceInput.js — Web Speech API speech recognition.
 *
 * Provides:
 *   isListening  — boolean
 *   transcript   — last heard phrase
 *   startListening / stopListening
 *   onCommand    — callback(text) called when recognition finalises a phrase
 *
 * Member B owns this file.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

export function useVoiceInput({ onCommand }) {
  const recognitionRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const onCommandRef = useRef(onCommand)

  // Keep ref up to date without recreating recognition
  useEffect(() => { onCommandRef.current = onCommand }, [onCommand])

  const init = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return null

    const rec = new SpeechRecognition()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += text
        } else {
          interim += text
        }
      }
      if (interim) setTranscript(interim)
      if (final) {
        setTranscript(final.trim())
        onCommandRef.current?.(final.trim())
      }
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.warn('Speech recognition error:', e.error)
        setIsListening(false)
        
        let msg = `[Mic Error: ${e.error}]`
        if (e.error === 'audio-capture') {
          msg = '[Mic Error: Audio capture failed. Is another app using the mic?]'
        } else if (e.error === 'not-allowed') {
          msg = '[Mic Error: Permissions denied. Please allow microphone access.]'
        }
        
        setTranscript(msg)
        onCommandRef.current?.(msg)
      }
    }

    rec.onend = () => {
      // Auto-restart if we were still supposed to be listening
      if (recognitionRef.current?._shouldListen) {
        recognitionRef.current.start()
      } else {
        setIsListening(false)
      }
    }

    return rec
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      recognitionRef.current = init()
    }
    if (!recognitionRef.current) return
    recognitionRef.current._shouldListen = true
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch { /* already started */ }
  }, [init])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current._shouldListen = false
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  // Clean up on unmount
  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current._shouldListen = false
      recognitionRef.current.stop()
    }
  }, [])

  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  return { isListening, transcript, startListening, stopListening, supported }
}
