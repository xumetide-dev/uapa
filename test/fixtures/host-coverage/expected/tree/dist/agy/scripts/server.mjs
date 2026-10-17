// host-coverage 夹具的共用文件：最小的 MCP stdio 服务器，只应答 initialize 与 tools/list。
// 不读取环境变量的值，不写文件。
import { createInterface } from 'node:readline'

const send = message => process.stdout.write(`${JSON.stringify(message)}\n`)

function parse(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null // 不是 JSON 的行不是 JSON-RPC 消息，不应答
  }
}

createInterface({ input: process.stdin }).on('line', line => {
  const message = parse(line)
  if (message === null || message.id === undefined) return
  if (message.method === 'initialize') {
    const protocolVersion = message.params?.protocolVersion ?? '2025-06-18'
    const serverInfo = { name: 'host-coverage', version: '0.1.0' }
    const result = { protocolVersion, capabilities: { tools: {} }, serverInfo }
    send({ jsonrpc: '2.0', id: message.id, result })
  } else if (message.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: message.id, result: { tools: [] } })
  } else {
    const error = { code: -32601, message: 'method not found' }
    send({ jsonrpc: '2.0', id: message.id, error })
  }
})
