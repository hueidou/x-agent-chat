import { useState, useEffect, useCallback } from 'react'
import { api } from './api'
import type { ServerInfo, Agent, Channel, Message, Task } from './types'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import MessageInput from './components/MessageInput'
import AgentPanel from './components/AgentPanel'
import TaskPanel from './components/TaskPanel'

type PanelTab = 'agents' | 'tasks'

export default function App() {
  const [server, setServer] = useState<ServerInfo | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeChannel, setActiveChannel] = useState('all')
  const [panelTab, setPanelTab] = useState<PanelTab>('agents')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState<{ agentName: string; content: string; status: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, a, ch, t] = await Promise.all([
        api.server(), api.agents(), api.channels(), api.tasks()
      ])
      setServer(s); setAgents(a); setChannels(ch); setTasks(t)
      if (ch.length > 0 && !ch.find(c => c.name === activeChannel)) {
        setActiveChannel(ch[0].name)
      }
    } catch (e) {
      console.error('load failed', e)
    } finally {
      setLoading(false)
    }
  }, [activeChannel])

  const loadMessages = useCallback(async (channelName: string) => {
    try {
      setMessages(await api.messages(channelName))
    } catch { setMessages([]) }
  }, [])

  useEffect(() => { load() }, [])
  useEffect(() => { if (channels.length) loadMessages(activeChannel) }, [activeChannel, channels])

  useEffect(() => {
    if (!channels.length) return
    const src = new EventSource('/api/stream')
    src.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'agent_stream') {
          if (data.status === 'done') {
            setStreaming(null)
            loadMessages(activeChannel)
          } else {
            setStreaming({ agentName: data.agentName, content: data.content, status: data.status })
          }
        } else if (data.type === 'message') {
          loadMessages(activeChannel)
        }
      } catch {}
    }
    src.onerror = () => src.close()
    return () => src.close()
  }, [activeChannel, channels.length])

  const handleSend = async (content: string) => {
    try {
      await api.sendMessage(activeChannel, content)
      await loadMessages(activeChannel)
      await load() // refresh counts
    } catch (e: any) { alert(e.message) }
  }

  const handleCreateChannel = async () => {
    const name = prompt('Channel name:')
    if (!name) return
    try {
      await api.createChannel(name)
      setChannels(await api.channels())
      setActiveChannel(name)
    } catch (e: any) { alert(e.message) }
  }

  const handleCreateAgent = async () => {
    const name = prompt('Agent name:')
    if (!name) return
    const desc = prompt('Description:') || ''
    const runtime = prompt('Runtime (opencode/claude-code):') || 'opencode'
    try {
      await api.createAgent(name, desc, runtime)
      setAgents(await api.agents())
      setServer(await api.server())
    } catch (e: any) { alert(e.message) }
  }

  const handleClaimTask = async (taskId: string, handle: string) => {
    const agent = agents.find(a => a.handle === handle)
    if (!agent) return alert(`Agent not found: ${handle}`)
    try {
      await api.updateTask(taskId, { status: 'claimed', claimedBy: agent.id })
      setTasks(await api.tasks())
      setAgents(await api.agents())
    } catch (e: any) { alert(e.message) }
  }

  const handleDoneTask = async (taskId: string) => {
    try {
      await api.updateTask(taskId, { status: 'completed' })
      setTasks(await api.tasks())
    } catch (e: any) { alert(e.message) }
  }

  const handleCreateTask = async () => {
    const title = prompt('Task title:')
    if (!title) return
    const desc = prompt('Description:') || ''
    const assignStr = prompt('Assign to? (comma separated, e.g. @alice,@bob):') || ''
    const handles = assignStr ? assignStr.split(',').map(h => h.trim()).filter(Boolean) : undefined
    try {
      await api.createTask(title, desc, handles)
      setTasks(await api.tasks())
    } catch (e: any) { alert(e.message) }
  }

  if (loading) {
    return (
      <div className="app">
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="big">🚀</div>
          <div>Connecting to Raft server...</div>
        </div>
      </div>
    )
  }

  const currentChannel = channels.find(c => c.name === activeChannel)

  return (
    <div className="app">
      <Sidebar
        server={server}
        channels={channels}
        activeChannel={activeChannel}
        onSelect={n => setActiveChannel(n)}
        onCreateChannel={handleCreateChannel}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <ChatArea channel={currentChannel} messages={messages} streaming={streaming} />
        <MessageInput onSend={handleSend} agents={agents} channelName={activeChannel} />
      </div>

      <div className="right-panel">
        <div className="panel-tabs">
          <div className={`panel-tab${panelTab === 'agents' ? ' active' : ''}`} onClick={() => setPanelTab('agents')}>
            🤖 Agent ({agents.length})
          </div>
          <div className={`panel-tab${panelTab === 'tasks' ? ' active' : ''}`} onClick={() => setPanelTab('tasks')}>
            📋 Tasks ({tasks.length})
          </div>
        </div>

        {panelTab === 'agents' ? (
          <>
            <AgentPanel agents={agents} onWake={() => {}} />
            <div className="quick-actions">
              <button className="quick-btn" onClick={handleCreateAgent}>+ Agent</button>
            </div>
          </>
        ) : (
          <>
            <TaskPanel tasks={tasks} agents={agents} onClaim={handleClaimTask} onDone={handleDoneTask} />
            <div className="quick-actions">
              <button className="quick-btn" onClick={handleCreateTask}>+ Task</button>
              <button className="quick-btn" onClick={async () => {
                setTasks(await api.tasks())
              }}>🔄 Refresh</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
