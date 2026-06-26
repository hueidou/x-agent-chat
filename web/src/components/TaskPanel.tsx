import type { Task, Agent } from '../types'

interface Props {
  tasks: Task[]
  agents: Agent[]
  onClaim: (taskId: string, agentHandle: string) => void
  onDone: (taskId: string) => void
}

export default function TaskPanel({ tasks, agents, onClaim, onDone }: Props) {
  return (
    <div className="panel-body">
      {tasks.length === 0 ? (
        <div className="empty-state" style={{ height: 120 }}>
          <div className="big">📋</div>
          <div>暂无任务</div>
        </div>
      ) : tasks.map(t => {
        const claimedAgent = t.claimedBy ? agents.find(a => a.id === t.claimedBy) : null
        return (
          <div key={t.id} className="task-card">
            <div className="task-title">{t.title}</div>
            <span className={`task-status ${t.status}`}>{t.status}</span>
            {t.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{t.description}</div>}
            <div className="task-meta">
              {t.assignedNames?.length ? `指派: ${t.assignedNames.join(', ')}` : ''}
              {claimedAgent ? ` | 认领: ${claimedAgent.name}` : ''}
            </div>
            {t.status === 'pending' && (
              <button className="task-btn" onClick={() => {
                const h = prompt('输入 Agent handle (如 @alice):')
                if (h) onClaim(t.id, h)
              }}>认领</button>
            )}
            {t.status === 'claimed' && (
              <button className="task-btn" onClick={() => {
                if (confirm(`确认完成任务 "${t.title}"?`)) onDone(t.id)
              }}>✅ 完成</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
