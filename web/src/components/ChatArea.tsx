import { useEffect, useRef } from 'react'
import type { Message, Channel } from '../types'

interface StreamingState {
  agentName: string
  content: string
  status: string
}

interface Props {
  channel: Channel | undefined
  messages: Message[]
  streaming?: StreamingState | null
}

export default function ChatArea({ channel, messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streaming?.content])

  if (!channel) {
    return (
      <div className="main">
        <div className="empty-state">
          <div className="big">💬</div>
          <div>Select a channel to start</div>
        </div>
      </div>
    )
  }

  function renderContent(text: string) {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) =>
      part.startsWith('@') ? <span key={i} className="mention">{part}</span> : part
    )
  }

  return (
    <div className="main">
      <div className="chat-header">
        <span># {channel.name}</span>
        <span className="topic">{messages.length} messages</span>
      </div>
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state" style={{ height: 200 }}>
            <div className="big">📝</div>
            <div>Send the first message</div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className="msg">
            <div className={`msg-avatar ${m.sender.type === 'agent' ? 'msg-agent' : 'msg-human'}`}
              style={{ background: m.sender.type === 'agent' ? 'rgba(163,113,247,0.2)' : 'rgba(63,185,80,0.2)' }}>
              {m.sender.name[0].toUpperCase()}
            </div>
            <div className="msg-body">
              <div className="msg-header">
                <span className="msg-name" style={{
                  color: m.sender.type === 'agent' ? 'var(--purple)' : 'var(--green)'
                }}>
                  {m.sender.name}
                </span>
                <span className="msg-time">
                  {new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {m.sender.handle && (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.sender.handle}</span>
                )}
              </div>
              <div className="msg-text">{renderContent(m.content)}</div>
            </div>
          </div>
        ))}
        {streaming && (
          <div className="msg streaming-msg">
            <div className="msg-avatar msg-agent" style={{ background: 'rgba(163,113,247,0.2)' }}>
              {streaming.agentName[0].toUpperCase()}
            </div>
            <div className="msg-body">
              <div className="msg-header">
                <span className="msg-name" style={{ color: 'var(--purple)' }}>
                  {streaming.agentName}
                </span>
                <span className="streaming-indicator">Replying...</span>
              </div>
              <div className="msg-text">{streaming.content}<span className="cursor-blink">|</span></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
