#!/usr/bin/env node
import { BridgeClient } from './BridgeClient.js'

const args = process.argv.slice(2)

function usage(): void {
  console.log(`
Usage: raft agent start [options]

Options:
  --server <url>      Raft server address (default http://localhost:4173)
  --handle <handle>   Agent handle (e.g. @alice)
  --name <name>       Agent name
  --runtime <type>    Runtime (opencode, claude-code)

Examples:
  raft agent start --server http://localhost:4173 --handle @alice --name Alice --runtime opencode
  raft agent start --server https://my-server.com --handle @bob --name Bob --runtime claude-code
`)
  process.exit(0)
}

function parseArgs(): { serverUrl: string; handle: string; name: string; runtime: string } {
  if (args.includes('--help') || args.includes('-h')) usage()

  const get = (flag: string, def?: string): string => {
    const idx = args.indexOf(flag)
    return idx >= 0 ? args[idx + 1] : def ?? ''
  }

  return {
    serverUrl: get('--server', 'http://localhost:4173'),
    handle: get('--handle'),
    name: get('--name'),
    runtime: get('--runtime', 'opencode'),
  }
}

async function main(): Promise<void> {
  const config = parseArgs()

  if (!config.handle || !config.name) {
    console.error('❌ --handle and --name are required')
    usage()
  }

  const client = new BridgeClient({
    serverUrl: config.serverUrl,
    handle: config.handle,
    name: config.name,
    runtime: config.runtime,
  })

  process.on('SIGINT', () => { client.stop(); process.exit(0) })
  process.on('SIGTERM', () => { client.stop(); process.exit(0) })

  await client.start()
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
