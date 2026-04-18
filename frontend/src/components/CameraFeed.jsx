/**
 * CameraFeed.jsx — Live camera video + canvas overlay for bounding boxes.
 *
 * Props:
 *   videoRef    React ref
 *   canvasRef   React ref
 *   isReady     boolean
 *   error       string | null
 *   faces       Array<{ name, emotion, position, known }>
 *
 * Draws bounding boxes on the canvas overlay whenever `faces` updates.
 * Green box = known face, Yellow box = unknown.
 *
 * Member B owns this file.
 */

import { useEffect } from 'react'
import { Camera } from 'lucide-react'

const BOX_LINE_WIDTH = 2
const FONT = '13px Inter, sans-serif'
const KNOWN_COLOR = '#22c55e'
const UNKNOWN_COLOR = '#f59e0b'
const BACKGROUND_ALPHA = 0.55

export default function CameraFeed({ videoRef, canvasRef, isReady, error, faces = [] }) {
  // Draw bounding boxes whenever faces array changes
  useEffect(() => {
    const canvas = canvasRef?.current
    const video = videoRef?.current
    if (!canvas || !video || !isReady) return

    const ctx = canvas.getContext('2d')

    const { clientWidth: dw, clientHeight: dh } = video
    canvas.width = dw
    canvas.height = dh
    // Scale factor: image frame vs display size
    const vidW = video.naturalWidth || video.videoWidth || dw
    const vidH = video.naturalHeight || video.videoHeight || dh
    const scaleX = dw / vidW
    const scaleY = dh / vidH
    const frameScaleX = scaleX * 2
    const frameScaleY = scaleY * 2

    ctx.clearRect(0, 0, dw, dh)

    for (const face of faces) {
      const { top, right, bottom, left } = face.position
      const x = left * frameScaleX
      const y = top * frameScaleY
      const w = (right - left) * frameScaleX
      const h = (bottom - top) * frameScaleY
      const color = face.known ? KNOWN_COLOR : UNKNOWN_COLOR

      // Box
      ctx.strokeStyle = color
      ctx.lineWidth = BOX_LINE_WIDTH
      ctx.shadowColor = color
      ctx.shadowBlur = 8
      ctx.strokeRect(x, y, w, h)
      ctx.shadowBlur = 0

      // Label background
      const labelLines = []
      if (face.name) labelLines.push(face.name)
      else labelLines.push('Unknown')
      if (face.emotion) labelLines.push(face.emotion)

      const labelHeight = labelLines.length * 17 + 6
      ctx.fillStyle = `rgba(10,10,15,${BACKGROUND_ALPHA})`
      ctx.fillRect(x, y - labelHeight, Math.max(w, 90), labelHeight)

      // Label text
      ctx.font = FONT
      ctx.fillStyle = color
      labelLines.forEach((line, i) => {
        ctx.fillText(line, x + 4, y - labelHeight + 14 + i * 17)
      })
    }
  }, [faces, isReady, videoRef, canvasRef])

  return (
    <div
      id="camera-feed"
      className="camera-wrapper"
      style={{ height: '100%' }}
    >
      {/* Live video explicitly as an img for MJPEG */}
      <img
        ref={videoRef} // kept named videoRef for compatibility
        id="camera-video"
        alt="DroidCam Stream"
        style={{ display: isReady ? 'block' : 'none', position: 'relative', width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Bounding box canvas overlay */}
      <canvas
        ref={canvasRef}
        id="face-overlay-canvas"
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Placeholder when camera not ready */}
      {!isReady && (
        <div
          className="camera-placeholder"
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        >
          <Camera size={40} style={{ color: 'var(--text-muted)' }} />
          {error ? (
            <span style={{ color: 'var(--accent-red)', maxWidth: 260, textAlign: 'center' }}>{error}</span>
          ) : (
            <span>Starting camera…</span>
          )}
        </div>
      )}
    </div>
  )
}
