/**
 * DebugConsole.jsx — On-screen logger for mobile debugging.
 */
import { Terminal } from 'lucide-react'

export default function DebugConsole({ logs = [] }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '30vh',
        background: 'rgba(0,0,0,0.9)',
        borderTop: '2px solid var(--accent-blue)',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        overflowY: 'auto',
        zIndex: 9999,
        padding: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent-blue-bright)', marginBottom: 10, fontWeight: 'bold' }}>
        <Terminal size={14} /> DEBUG LOGS (Scroll for more)
      </div>
      {logs.slice().reverse().map((log, i) => (
        <div key={i} style={{ marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
          <span style={{ color: '#888' }}>[{log.time}]</span>{' '}
          <span style={{ color: log.type === 'error' ? 'var(--accent-red)' : log.type === 'warn' ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
            {log.msg}
          </span>
        </div>
      ))}
    </div>
  )
}
