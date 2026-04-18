/**
 * neytraApi.js — Axios wrappers for all Neytra backend endpoints.
 *
 * Every component/hook calls functions from here — never raw fetch().
 * To point at a different backend, change BASE_URL only.
 *
 * Member B owns this file.
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
})

const stripPrefix = (str) => str ? str.replace(/^data:image\/[a-z]+;base64,/, '') : null

/**
 * POST /scene
 * @param {string} frame - base64 JPEG
 * @param {string|null} locationId - optional active memory location
 * @param {boolean} useNIM - use nvidia nim gemma
 * @returns {{ narration: string, hazard: boolean, hazard_type: string|null }}
 */
export async function postScene(frame, locationId = null, useNIM = false) {
  const { data } = await api.post('/scene', { frame: stripPrefix(frame), location_id: locationId, use_nim: useNIM })
  return data
}

/**
 * POST /face
 * @param {string} frame - base64 JPEG
 * @returns {{ faces: Array<{ name, emotion, position, known, encoding_hash }> }}
 */
export async function postFace(frame) {
  const { data } = await api.post('/face', { frame: stripPrefix(frame) })
  return data
}

/**
 * POST /command
 * @param {string} text - raw voice command
 * @param {string|null} frame - optional current frame
 * @param {boolean} useNIM - use nvidia nim gemma
 * @returns {{ action: string, response: string }}
 */
export async function postCommand(text, frame = null, useNIM = false) {
  const { data } = await api.post('/command', { text, frame: stripPrefix(frame), use_nim: useNIM })
  return data
}

/**
 * POST /memory/save
 * @param {string} locationId
 * @param {string} description
 * @param {boolean} landmark
 * @returns {{ success: boolean, waypoint_count: number }}
 */
export async function saveMemoryWaypoint(locationId, description, landmark = false) {
  const { data } = await api.post('/memory/save', {
    location_id: locationId,
    description,
    landmark,
  })
  return data
}

/**
 * GET /memory/:id
 * @param {string} locationId
 * @returns {{ location_id, created, waypoints: Array }}
 */
export async function getMemory(locationId) {
  const { data } = await api.get(`/memory/${locationId}`)
  return data
}

/**
 * GET /memory
 * @returns {{ locations: Array<{ location_id, display_name, waypoint_count, created }> }}
 */
export async function listMemory() {
  const { data } = await api.get('/memory')
  return data
}

/**
 * POST /enroll
 * @param {string} frame - base64 JPEG with exactly one face
 * @param {string} name
 * @returns {{ success: boolean, message: string }}
 */
export async function enrollFace(frame, name) {
  const { data } = await api.post('/enroll', { frame: stripPrefix(frame), name })
  return data
}

/**
 * POST /scan
 * Unified lightweight scan: YOLO + conditional face recognition.
 * @param {string} frame - base64 JPEG
 * @returns {{ labels: string, hazard: boolean, hazard_type: string|null, person_detected: boolean, faces: Array }}
 */
export async function postScan(frame) {
  const { data } = await api.post('/scan', { frame: stripPrefix(frame) })
  return data
}
