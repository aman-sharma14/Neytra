/**
 * MemoryPanel.jsx — Spatial memory browser + face enrollment UI.
 *
 * Props:
 *   locations   Array<{ location_id, display_name, waypoint_count, created }>
 *   onLoad      (location_id) => void  — called when user taps a location
 *   activeId    string | null          — currently active location
 *   onEnroll    (name) => void         — initiates face enrollment
 *
 * Member B owns this file.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Route, UserPlus, ChevronRight, Loader } from 'lucide-react'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function MemoryPanel({ locations = [], onLoad, activeId, onEnroll }) {
  const [enrollName, setEnrollName] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  const handleEnroll = async () => {
    if (!enrollName.trim()) return
    setEnrolling(true)
    await onEnroll?.(enrollName.trim())
    setEnrollName('')
    setEnrolling(false)
  }

  return (
    <div
      id="memory-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 2px' }}
    >
      {/* ── Saved Locations ── */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
          SAVED LOCATIONS
        </div>

        {locations.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '12px 0' }}>
            No locations saved yet. Say <em>"Remember this as [name]"</em> to save one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {locations.map((loc) => {
              const isActive = loc.location_id === activeId
              return (
                <motion.button
                  key={loc.location_id}
                  id={`memory-loc-${loc.location_id}`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onLoad?.(loc.location_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isActive ? 'var(--border-active)' : 'var(--border)'}`,
                    background: isActive ? 'rgba(59,130,246,0.1)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <MapPin size={16} style={{ color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: isActive ? 'var(--accent-blue-bright)' : 'var(--text-primary)' }}>
                      {loc.display_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      <Route size={10} style={{ display: 'inline', marginRight: 4 }} />
                      {loc.waypoint_count} waypoint{loc.waypoint_count !== 1 ? 's' : ''} · {formatDate(loc.created)}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Enroll Face ── */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
          ENROLL FACE
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="enroll-name-input"
            type="text"
            placeholder="Enter person's name…"
            value={enrollName}
            onChange={(e) => setEnrollName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEnroll()}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
          <motion.button
            id="enroll-btn"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleEnroll}
            disabled={enrolling || !enrollName.trim()}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--accent-blue)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: enrolling ? 'not-allowed' : 'pointer',
              opacity: enrolling || !enrollName.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {enrolling ? <Loader size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Enroll
          </motion.button>
        </div>
      </div>
    </div>
  )
}
