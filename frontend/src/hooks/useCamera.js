/**
 * useCamera.js — Camera access and frame capture.
 *
 * Provides:
 *   videoRef     — attach to <video> element
 *   canvasRef    — attach to <canvas> overlay
 *   isReady      — true once camera is streaming
 *   error        — error message string or null
 *   captureFrame — () => base64 JPEG string | null
 *   startCamera  — () => void
 *   stopCamera   — () => void
 *
 * Member B owns this file.
 */

import { useRef, useState, useCallback } from 'react'

const CAPTURE_QUALITY = 0.7  // JPEG quality 0–1
const CAPTURE_SCALE = 0.5    // Downscale for faster upload (50%)

export function useCamera() {
  const videoRef = useRef(null) // Renamed to imgRef below but kept for compatibility
  const imgRef = useRef(null) 
  const canvasRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)

  const startCamera = useCallback(async () => {
    setError(null)
    setIsReady(false)
    const img = imgRef.current
    if (img) {
      // Droidcam streams MJPEG via /video endpoint
      img.crossOrigin = 'anonymous'
      img.src = '/droidcam/video'
      img.onload = () => setIsReady(true)
      img.onerror = () => {
        setError('Failed to connect to DroidCam stream.')
        setIsReady(false)
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (imgRef.current) imgRef.current.src = ''
    setIsReady(false)
  }, [])

  /**
   * Capture the current video frame as a base64 JPEG string.
   */
  const captureFrame = useCallback(() => {
    const img = imgRef.current
    // Image readyState isn't a thing, we use isReady
    if (!img) return null

    // For generic <img>, naturalWidth is available once loaded
    const nw = img.naturalWidth || 640
    const nh = img.naturalHeight || 480
    if (nw === 0) return null

    const w = Math.floor(nw * CAPTURE_SCALE)
    const h = Math.floor(nh * CAPTURE_SCALE)

    const offscreen = document.createElement('canvas')
    offscreen.width = w
    offscreen.height = h
    const ctx = offscreen.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    return offscreen.toDataURL('image/jpeg', CAPTURE_QUALITY).split(',')[1]
  }, [])

  return { videoRef: imgRef, canvasRef, isReady, error, captureFrame, startCamera, stopCamera }
}
