/**
 * App.jsx — Neytra single-page application root.
 *
 * Orchestrates all hooks and renders the three-zone layout:
 *   Zone 1: StatusBar
 *   Zone 2: Camera feed + Hazard overlay
 *   Zone 3: Narration + Voice echo + Bottom tabs
 *
 * State owned here:
 *   narration, hazard, faces, activeMemory, locations, activeTab, command confirmation
 *
 * Member B owns this file.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Play, Square, Brain, User } from 'lucide-react'

import StatusBar from './components/StatusBar'
import CameraFeed from './components/CameraFeed'
import HazardAlert from './components/HazardAlert'
import NarrationPanel from './components/NarrationPanel'
import VoiceCommandEcho from './components/VoiceCommandEcho'
import MemoryPanel from './components/MemoryPanel'
import DebugConsole from './components/DebugConsole'

import { useCamera } from './hooks/useCamera'
import { useVoiceInput } from './hooks/useVoiceInput'
import { useVoiceSpeech } from './hooks/useVoiceSpeech'
import { useFrameLoop } from './hooks/useFrameLoop'

import {
  postCommand,
  postScene,
  listMemory,
  saveMemoryWaypoint,
  enrollFace,
} from './api/neytraApi'

// ── Hazard auto-dismiss duration ──────────────────────────────────────────────
const HAZARD_DISMISS_MS = 4000

export default function App() {
  // Camera
  const { videoRef, canvasRef, isReady, error: camError, captureFrame, startCamera, stopCamera } = useCamera()

  // Speech
  const { speak, stop: stopSpeech, speaking } = useVoiceSpeech()

  // Frame loop (unified scan: YOLO labels + face recognition)
  const { start: startLoop, stop: stopLoop, isRunning, setBusy } = useFrameLoop()

  // State
  const [narration, setNarration] = useState('')
  const [prevNarration, setPrevNarration] = useState('')
  const [hazard, setHazard] = useState(false)
  const [hazardType, setHazardType] = useState(null)
  const [faces, setFaces] = useState([])
  const [transcript, setTranscript] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [activeMemoryId, setActiveMemoryId] = useState(null)
  const [activeMemoryName, setActiveMemoryName] = useState(null)
  const [locations, setLocations] = useState([])
  const [activeTab, setActiveTab] = useState('memory') // 'memory' | 'faces'
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const [useNIM, setUseNIM] = useState(false)

  const activeMemoryIdRef = useRef(null)
  const useNIMRef = useRef(false)
  const hazardTimerRef = useRef(null)
  const isStarted = useRef(false)

  // ── Logger ──────────────────────────────────────────────────────────────────
  const addLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })
    setLogs(prev => [...prev.slice(-49), { time, msg, type }])
    console.log(`[${time}] [${type}] ${msg}`)
  }, [])

  // ── Fetch memory list ───────────────────────────────────────────────────────
  const refreshMemory = useCallback(async () => {
    try {
      addLog('Fetching memory locations...')
      const { locations: locs } = await listMemory()
      setLocations(locs)
      addLog(`Loaded ${locs.length} memory locations`)
    } catch (err) {
      addLog(`Failed to fetch memory: ${err.message}`, 'error')
    }
  }, [addLog])

  // ── Unified scan result handler ──────────────────────────────────────────────
  const knownFacesRef = useRef([])  // persistent list of known faces across session

  const handleScanResult = useCallback((result) => {
    if (result.error) {
      addLog(`/scan API failed: ${result.error}`, 'error')
      return
    }

    const { labels, hazard: isHazard, hazard_type, faces: detectedFaces, person_detected, labelsChanged } = result
    addLog(`/scan: "${labels}" | hazard=${isHazard} | persons=${person_detected} | faces=${detectedFaces?.length || 0}`)

    // Update narration panel with spatial labels
    setPrevNarration(prev => prev !== narration ? narration : prev)
    setNarration(labels)

    // ── Hazard alert (highest priority) ───────────────────────────────────
    if (isHazard) {
      addLog(`YOLO Hazard: ${hazard_type}`, 'warn')
      setHazard(true)
      setHazardType(hazard_type)
      stopSpeech()
      speak(hazard_type ? `Warning! ${hazard_type} ahead.` : 'Hazard detected!', 0, 1.15, 1.2)

      clearTimeout(hazardTimerRef.current)
      hazardTimerRef.current = setTimeout(() => setHazard(false), HAZARD_DISMISS_MS)
      return  // hazard takes priority, skip label speech this tick
    }

    // ── Face handling (when person detected by YOLO) ──────────────────────
    if (detectedFaces && detectedFaces.length > 0) {
      // Update faces state for the UI panel
      setFaces([...detectedFaces])

      // Track known faces across session
      detectedFaces.forEach(f => {
        if (f.known && f.name) {
          const exists = knownFacesRef.current.some(k => k.name === f.name)
          if (!exists) {
            knownFacesRef.current = [...knownFacesRef.current, { name: f.name, emotion: f.emotion, encoding_hash: f.encoding_hash }]
          }
        }
      })

      // Announce known faces that cleared their timer
      const toAnnounce = detectedFaces.filter(f => f.should_announce && f.known && f.name)
      toAnnounce.forEach((face, i) => {
        addLog(`Announcing known face: ${face.name}`, 'info')
        const pos = face.position
        const side = pos.left < 320 ? 'on your left' : 'on your right'
        setTimeout(() => {
          speak(`${face.name} is ${side}.`, 1, 1, 1)
        }, i * 700)
      })

      // Prompt enrollment for unknown faces that hit their 15s/3-count logic
      const unknowns = detectedFaces.filter(f => !f.known && f.should_enroll_prompt)
      unknowns.forEach((_, i) => {
        addLog('Requesting enrollment for unknown face', 'warn')
        setTimeout(() => {
          speak('Unknown person detected. Say "save face as" followed by their name.', 1, 1, 1)
        }, (toAnnounce.length + i) * 700)
      })

      // If faces were announced, skip label speech this tick
      if (toAnnounce.length > 0 || unknowns.length > 0) return
    } else if (!person_detected) {
      // No person in frame — clear faces UI
      setFaces([])
    }

    // ── Speak spatial labels if changed ───────────────────────────────────
    if (labelsChanged && labels && labels !== 'path clear') {
      speak(labels, 2, 0.95, 1)
    }
  }, [narration, speak, stopSpeech, addLog])

  // ── Voice command handler ───────────────────────────────────────────────────
  const handleCommand = useCallback(async (text) => {
    setTranscript(text)
    setBusy(true)
    addLog(`Heard command: "${text}"`, 'info')

    // Stop any ongoing narration speech immediately when user speaks
    stopSpeech()

    if (text.startsWith('[Mic Error')) {
      speak('Microphone access issue perfectly identified. Check browser permissions.', 1, 1, 1)
      setBusy(false)
      return
    }

    try {
      const frame = captureFrame()
      addLog(`Sending to /command (NIM=${useNIMRef.current})...`, 'info')
      const { action, response } = await postCommand(text, frame, useNIMRef.current)
      addLog(`Command response: [${action}] ${response}`, 'info')

      setConfirmation(`Understood: ${response}`)
      speak(response, 1, 1, 1)
      setTimeout(() => setConfirmation(null), 5000)

      // Side effects of actions
      if (action === 'stop') {
        stopSpeech()
      }
      // ── On-demand full scene analysis via Gemini ─────────────────────────
      if (action === 'scene_describe') {
        addLog('Triggering full Gemini scene analysis...', 'info')
        try {
          const sceneFrame = captureFrame()
          const locId = activeMemoryIdRef.current
          const sceneResult = await postScene(sceneFrame, locId, useNIMRef.current)
          const fullNarration = sceneResult.narration || 'Could not describe the scene.'
          addLog(`Full scene: "${fullNarration.slice(0, 60)}..."`, 'info')
          setPrevNarration(narration)
          setNarration(fullNarration)
          stopSpeech()
          speak(fullNarration, 1, 0.95, 1)
        } catch (e) {
          addLog(`Full scene analysis failed: ${e.message}`, 'error')
          speak('Scene analysis failed. Please try again.', 1)
        }
      }
      if (action === 'enroll') {
        const name = response || 'Unknown'
        addLog(`Enrolling face as ${name}`, 'info')
        const enrollFrame = captureFrame()  // fresh frame, not stale command frame
        try {
          const enrollRes = await enrollFace(enrollFrame, name)
          speak(enrollRes.message || `Face saved as ${name}.`, 1, 1, 1)
          addLog(`Enrollment: ${enrollRes.message}`, 'info')
        } catch(e) {
          addLog(`Enrollment failed: ${e.message}`, 'error')
          speak('Failed to save face. Make sure the person is clearly visible.', 1, 1, 1)
        }
      }
      if (action === 'remember') {
        // Extract name from text and save current frame as a waypoint
        const match = text.match(/(?:remember|save|mark) this as\s+(.+)/i)
        const locName = match?.[1] || 'unnamed'
        const locId = locName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
        activeMemoryIdRef.current = locId
        setActiveMemoryId(locId)
        setActiveMemoryName(locName)
        // The actual waypoint description will come from the next scene narration
        if (narration) {
          addLog(`Saving waypoint for ${locId}...`, 'info')
          await saveMemoryWaypoint(locId, narration, false)
          refreshMemory()
        }
      }
      if (action === 'navigate') {
        const match = text.match(/(?:take me to|go to|navigate to)\s+(.+)/i)
        const locName = match?.[1] || ''
        const locId = locName.toLowerCase().replace(/[^a-z0-9]+/g, '_')
        activeMemoryIdRef.current = locId
        setActiveMemoryId(locId)
        setActiveMemoryName(locName)
      }
    } catch (err) {
      addLog(`/command API error: ${err.message}`, 'error')
      speak('Sorry, I could not connect to Neytra. Please check the backend.', 1)
    } finally {
      setBusy(false)
    }
  }, [captureFrame, speak, stopSpeech, setBusy, narration, refreshMemory, addLog])

  // ── Start / Stop ────────────────────────────────────────────────────────────
  const { isListening, transcript: voiceTranscript, startListening, stopListening } =
    useVoiceInput({ onCommand: handleCommand })

  const handleStart = useCallback(async () => {
    if (isStarted.current) return
    isStarted.current = true
    addLog('Starting Neytra...', 'info')
    await startCamera()
    // Wait for camera/img to actually be ready to avoid empty first frames
    await new Promise(resolve => {
      const check = setInterval(() => {
        const el = videoRef.current
        if (el) {
          // generic check for both img and video tags
          if ((el.readyState >= 2) || (el.tagName === 'IMG' && el.complete && el.naturalWidth > 0)) {
            clearInterval(check)
            resolve()
          }
        }
      }, 100)
    })

    addLog('Camera started', 'info')
    startListening()
    addLog('Microphone listening', 'info')
    
    startLoop(
        () => captureFrame(),  // arrow wrapper prevents stale closure over captureFrame
        handleScanResult
    )
    addLog('Started unified scan loop (YOLO + face recognition)', 'info')
    refreshMemory()

    speak('Neytra is active. Camera is on.', 2, 1, 1)
  }, [startCamera, startListening, startLoop, captureFrame, handleScanResult, refreshMemory, speak, addLog])

  const handleStop = useCallback(() => {
    isStarted.current = false
    addLog('Stopping Neytra', 'warn')
    stopCamera()
    stopListening()
    stopLoop()
    stopSpeech()
    setFaces([])
  }, [stopCamera, stopListening, stopLoop, stopSpeech, addLog])

  // Keep transcript in sync with interim voice results
  useEffect(() => {
    if (voiceTranscript) setTranscript(voiceTranscript)
  }, [voiceTranscript])

  // ── Load memory location ────────────────────────────────────────────────────
  const handleLoadLocation = useCallback((locationId) => {
    const loc = locations.find(l => l.location_id === locationId)
    activeMemoryIdRef.current = locationId
    setActiveMemoryId(locationId)
    setActiveMemoryName(loc?.display_name || locationId)
    speak(`Memory loaded for ${loc?.display_name || locationId}. Starting navigation guidance.`, 1)
  }, [locations, speak])

  // ── Enroll face ─────────────────────────────────────────────────────────────
  const handleEnrollFace = useCallback(async (name) => {
    addLog(`Initiating enrollment for "${name}"`, 'info')
    const frame = captureFrame()
    if (!frame) { 
        speak('Camera is not ready.', 1)
        addLog('Enrollment failed: Camera not ready', 'warn')
        return 
    }
    try {
      const { success, message } = await enrollFace(frame, name)
      speak(message, 1)
      addLog(`Enrollment success: ${message}`, 'info')
    } catch (err) {
      speak('Enrollment failed. Please try again.', 1)
      addLog(`Enrollment error: ${err.message}`, 'error')
    }
  }, [captureFrame, speak, addLog])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
      
      {showLogs && <DebugConsole logs={logs} />}

      {/* Toggle Logs Button */}
      <button 
        onClick={() => setShowLogs(p => !p)}
        style={{
            position: 'absolute', top: 60, right: 16, zIndex: 100,
            background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none',
            padding: '5px 10px', borderRadius: 4, fontSize: '0.8rem', cursor: 'pointer'
        }}
      >
        {showLogs ? 'Hide Logs' : 'Show Logs'}
      </button>

      {/* Top Status Bar */}
      <StatusBar
        isNarrating={isRunning}
        isListening={isListening}
        activeMemory={activeMemoryName}
        useNIM={useNIM}
        onToggleNIM={() => {
          setUseNIM(prev => {
            const next = !prev
            useNIMRef.current = next
            return next
          })
        }}
      />

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left column: Camera ── */}
        <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>

          {/* Camera + hazard overlay wrapper */}
          <div style={{ flex: 1, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', minHeight: 0 }}>
            <CameraFeed
              videoRef={videoRef}
              canvasRef={canvasRef}
              isReady={isReady}
              error={camError}
              faces={faces}
            />
            <HazardAlert hazard={hazard} hazardType={hazardType} />
          </div>

          {/* Start / Stop controls */}
          <div style={{ display: 'flex', gap: 10 }}>
            <motion.button
              id="start-btn"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              disabled={isRunning}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: isRunning ? 'var(--bg-card)' : 'var(--accent-blue)',
                color: isRunning ? 'var(--text-muted)' : '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                fontFamily: 'var(--font-display)',
                transition: 'all 0.2s',
                ...(isRunning ? {} : { boxShadow: '0 0 20px var(--accent-blue-glow)' }),
              }}
            >
              <Play size={16} /> Start Neytra
            </motion.button>
            <motion.button
              id="stop-btn"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStop}
              disabled={!isRunning}
              style={{
                padding: '11px 22px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: isRunning ? 'var(--accent-red)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: !isRunning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-display)',
                transition: 'all 0.2s',
              }}
            >
              <Square size={14} /> Stop
            </motion.button>
          </div>
        </div>

        {/* ── Right column: Panels ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', minHeight: 0 }}>

          {/* Narration */}
          <NarrationPanel current={narration} previous={prevNarration} />

          {/* Voice echo */}
          <VoiceCommandEcho transcript={transcript} confirmation={confirmation} />

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {[
              { id: 'memory', label: 'Memory', Icon: Brain },
              { id: 'faces', label: 'Faces', Icon: User },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                id={`tab-${id}`}
                className={`tab-btn ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {activeTab === 'memory' && (
              <MemoryPanel
                locations={locations}
                onLoad={handleLoadLocation}
                activeId={activeMemoryId}
                onEnroll={handleEnrollFace}
              />
            )}
            {activeTab === 'faces' && (
              <div style={{ padding: '8px 2px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Currently visible faces */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
                    CURRENTLY IN FRAME
                  </div>
                  {faces.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No faces detected.</div>
                  ) : (
                    faces.map((f, i) => (
                      <div
                        key={f.encoding_hash || i}
                        className="glass-card"
                        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}
                      >
                        <div
                          style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: f.known ? 'var(--accent-green)' : 'var(--accent-amber)',
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                            {f.known ? f.name : 'Unknown'}
                          </div>
                          {f.emotion && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.emotion}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Persistent known faces across session */}
                {knownFacesRef.current.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--accent-green)', marginBottom: 6 }}>
                      KNOWN FACES (SESSION)
                    </div>
                    {knownFacesRef.current.map((f, i) => (
                      <div
                        key={f.encoding_hash || `known-${i}`}
                        className="glass-card"
                        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{f.name}</div>
                          {f.emotion && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.emotion}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
