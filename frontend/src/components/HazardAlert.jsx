/**
 * HazardAlert.jsx — Animated hazard banner overlaid on the camera feed.
 *
 * Props:
 *   hazard      boolean
 *   hazardType  string | null  — e.g. "stairs", "person", "car"
 *
 * Slides up from the bottom of the video zone.
 * Amber = caution (person/bicycle), Red = stop (stairs/vehicle).
 * Auto-dismisses via parent state after 4 seconds.
 *
 * Member B owns this file.
 */

import { AlertTriangle, OctagonAlert } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const STOP_HAZARDS = new Set(['stairs', 'step', 'car', 'bus', 'truck', 'motorcycle'])

function getHazardConfig(hazardType) {
  const isStop = STOP_HAZARDS.has(hazardType)
  return {
    color: isStop ? 'var(--accent-red)' : 'var(--accent-amber)',
    glow: isStop ? 'var(--accent-red-glow)' : 'var(--accent-amber-glow)',
    Icon: isStop ? OctagonAlert : AlertTriangle,
    label: isStop ? 'STOP' : 'CAUTION',
    pulseClass: isStop ? 'animate-pulse-red' : '',
  }
}

function formatHazardName(type) {
  if (!type) return 'Hazard detected'
  const map = {
    stairs: 'Staircase ahead',
    step: 'Step ahead',
    car: 'Vehicle ahead',
    bus: 'Bus ahead',
    truck: 'Truck ahead',
    motorcycle: 'Motorcycle nearby',
    bicycle: 'Bicycle nearby',
    person: 'Person in path',
    'fire hydrant': 'Obstacle ahead',
  }
  return map[type] ?? `${type.charAt(0).toUpperCase()}${type.slice(1)} detected`
}

export default function HazardAlert({ hazard, hazardType }) {
  const config = getHazardConfig(hazardType)

  return (
    <AnimatePresence>
      {hazard && (
        <motion.div
          id="hazard-alert"
          key={hazardType}
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className={config.pulseClass}
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            borderRadius: 'var(--radius-md)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(10,10,15,0.85)',
            border: `1.5px solid ${config.color}`,
            boxShadow: `0 0 20px ${config.glow}`,
            backdropFilter: 'blur(8px)',
            zIndex: 20,
          }}
        >
          <config.Icon size={20} style={{ color: config.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: config.color }}>
              {config.label}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              {formatHazardName(hazardType)}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
