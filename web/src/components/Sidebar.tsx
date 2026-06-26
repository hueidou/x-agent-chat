import type { Channel, ServerInfo } from '../types'

interface Props {
  server: ServerInfo | null
  channels: Channel[]
  activeChannel: string
  onSelect: (name: string) => void
  onCreateChannel: () => void
}

const colors = ['#58a6ff', '#3fb950', '#d29922', '#a371f7', '#f85149', '#79c0ff', '#56d364', '#e3b341']

export default function Sidebar({ server, channels, activeChannel, onSelect, onCreateChannel }: Props) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>🚀</span>
        {server?.server.name || 'Raft'}
        <span className="badge">v0.1</span>
      </div>
      <div className="sidebar-section">Channels</div>
      <div className="channel-list">
        {channels.map((ch, i) => (
          <div
            key={ch.id}
            className={`channel-item${ch.name === activeChannel ? ' active' : ''}`}
            onClick={() => onSelect(ch.name)}
          >
            <span style={{ color: colors[i % colors.length] }}>#</span>
            {ch.name}
          </div>
        ))}
      </div>
      <div className="quick-actions">
        <button className="quick-btn" onClick={onCreateChannel}>+ Channel</button>
      </div>
    </div>
  )
}
