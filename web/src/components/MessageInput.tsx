import { useState, useRef, useEffect } from 'react'

interface Props {
  onSend: (text: string) => void
  agents: { handle: string; name: string }[]
  channelName?: string
}

export default function MessageInput({ onSend, agents, channelName = 'all' }: Props) {
  const [text, setText] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = agents.filter(a =>
    a.handle.toLowerCase().includes(mentionFilter.toLowerCase())
  )

  useEffect(() => {
    const atIdx = text.lastIndexOf('@')
    if (atIdx >= 0 && (atIdx === 0 || text[atIdx - 1] === ' ')) {
      const after = text.slice(atIdx + 1)
      if (!after.includes(' ')) {
        setShowMentions(true)
        setMentionFilter(after)
        return
      }
    }
    setShowMentions(false)
  }, [text])

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  function pickMention(h: string) {
    const atIdx = text.lastIndexOf('@')
    const before = text.slice(0, atIdx)
    const after = text.slice(atIdx).split(' ').slice(1).join(' ')
    setText(before + h + ' ' + after)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  return (
    <div className="input-area" style={{ position: 'relative' }}>
      {showMentions && filtered.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 20, right: 20,
          background: '#1c2333', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '4px', marginBottom: 4,
          maxHeight: 160, overflowY: 'auto', zIndex: 10,
        }}>
          {filtered.map(a => (
            <div key={a.handle} onClick={() => pickMention(a.handle)}
              style={{
                padding: '6px 10px', cursor: 'pointer', borderRadius: 4,
                fontSize: 13, display: 'flex', gap: 8, alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(88,166,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ color: 'var(--accent)' }}>{a.handle}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
      <div className="input-wrap">
        <input
          ref={inputRef}
          placeholder={`Send message to #${channelName}... Type @ to mention an agent`}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button className="btn-send" onClick={send} disabled={!text.trim()}>Send</button>
      </div>
    </div>
  )
}
