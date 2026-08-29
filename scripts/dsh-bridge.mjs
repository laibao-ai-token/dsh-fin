#!/usr/bin/env node
/**
 * dsh-bridge — a terminal-like CLI bridge to the DSH (DeepSeek Harness) web API.
 *
 * Launched by OpenAlice (or any harness) as if it were a coding-agent CLI like
 * "claude". It speaks the verified DSH web gateway protocol:
 *
 *   Upstream   : HTTP POST http://<host>/api/<method> with a "client-request"
 *                envelope: { type, rpcId, method, payload } → JSON body
 *                { type:"server-response", rpcId, result:{ok,value|error} }.
 *   Downstream : WebSocket ws://<host>/api/events.mux. Each message is a
 *                "server-request" envelope whose payload is a mux frame
 *                (session/event, session/subscribed, approval/requested,
 *                question/requested, ...). A bare HTTP GET on the event paths
 *                is rejected with 426 "upgrade required" — WebSocket is the
 *                only downlink on the running web host.
 *
 * Key session RPCs (all verified against the live host):
 *   session.create  { sessionId?, cwd?, workspaceId? } → { sessionId }
 *                   (an explicit sessionId is honored → create-or-reopen)
 *   session.list    {} → { items:[{ sessionId, updatedAt, running, blank }] }
 *   session.history { sessionId } → session-not-found error for unknown ids
 *   session.prompt  { sessionId, mode:"queue", content:[{type:"text",text}] }
 *                   → { accepted:true }; the reply streams back on the mux
 *   session.cancel  { sessionId }
 *   /api/respond    client-response envelopes answering approval/question
 *                   frames keyed by their server-request rpcId.
 *
 * Output contract (consumed by OpenAlice's stdout scanner):
 *   line 1        : {"type":"session","id":"<session-id>"}
 *   headless text : the assistant's streamed reply text on stdout
 *   headless --json: JSONL events (assistant_delta, message, tool, approval,
 *                    question, turn_start, turn_end, result, error)
 *   interactive   : the same per prompt; tool/approval diagnostics on stderr
 *
 * Exit codes: 0 completed | 1 fatal (DSH unreachable, transport error) |
 *             130 interrupted by the user (SIGINT → session.cancel).
 *
 * Requires Node >= 22 (global fetch + global WebSocket); no npm dependencies.
 */

import readline from 'node:readline/promises'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

// A downstream consumer that stops reading early (head -1, a launcher that
// captures only the session line) must not crash the bridge with an unhandled
// EPIPE: treat a closed stdout as a clean, successful end of conversation.
process.stdout.on('error', (error) => {
  if (error?.code === 'EPIPE') process.exit(0)
  throw error
})
process.stderr.on('error', (error) => {
  if (error?.code === 'EPIPE') return // nowhere left to complain; keep going
  throw error
})

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const HELP = [
  'dsh-bridge — terminal-like bridge to the DSH web API',
  '',
  'Usage:',
  '  dsh-bridge [--prompt <text> | --prompt-stdin] [options]     headless one-shot',
  '  dsh-bridge [options]                                        interactive REPL',
  '',
  'Session selection:',
  '  --session-id <id>   create-or-reopen: resume <id> if it exists, else create',
  '                      a session with exactly that id',
  '  --resume <id>       alias of --session-id',
  '  --continue          resume the most recent non-blank session',
  '  --new-session       always create a fresh session (default when no flag)',
  '',
  'Modes and output:',
  '  --prompt <text>     headless: send one prompt, stream the reply, exit',
  '  --prompt-stdin      headless: read the prompt from stdin until EOF',
  '  --json              emit JSONL events instead of plain text',
  '  --show-reasoning    also stream model reasoning deltas (text mode)',
  '  --approve-all       auto-allow tool approval requests (headless convenience)',
  '  --cwd <path>        working directory for a newly created session',
  '                      (default: the bridge process cwd)',
  '',
  'Connection:',
  '  --dsh-url <url>     DSH web base URL (default: $DSH_URL or http://127.0.0.1:3080)',
  '  -h, --help          this help',
].join('\n')

function fail(msg, code = 1) {
  process.stderr.write('[dsh-bridge] error: ' + msg + '\n')
  process.exit(code)
}

function parseArgs(argv) {
  const opts = {
    prompt: undefined,
    promptStdin: false,
    sessionId: undefined,
    fresh: false,
    continueLast: false,
    json: false,
    showReasoning: false,
    approveAll: false,
    cwd: process.cwd(),
    dshUrl: process.env.DSH_URL || 'http://127.0.0.1:3080',
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => argv[++i] ?? fail('missing value for ' + arg)
    switch (arg) {
      case '--prompt': opts.prompt = next(); break
      case '--prompt-stdin': opts.promptStdin = true; break
      case '--session-id': opts.sessionId = next(); break
      case '--resume': opts.sessionId = next(); break
      case '--new-session': opts.fresh = true; break
      case '--continue': opts.continueLast = true; break
      case '--json': opts.json = true; break
      case '--show-reasoning': opts.showReasoning = true; break
      case '--approve-all': opts.approveAll = true; break
      case '--cwd': opts.cwd = next(); break
      case '--dsh-url': opts.dshUrl = next(); break
      case '-h': case '--help': opts.help = true; break
      default: fail('unknown argument: ' + arg + '\n\n' + HELP)
    }
  }
  if (opts.help) { process.stdout.write(HELP + '\n'); process.exit(0) }
  opts.headless = opts.prompt !== undefined || opts.promptStdin
  if (opts.prompt !== undefined && opts.promptStdin) fail('--prompt and --prompt-stdin are mutually exclusive')
  if (!/^https?:\/\//.test(opts.dshUrl)) fail('--dsh-url must start with http:// or https://')
  opts.dshUrl = opts.dshUrl.replace(/\/+$/, '')
  return opts
}
// ---------------------------------------------------------------------------
// DSH gateway client (verified protocol, see header)
// ---------------------------------------------------------------------------

class DshClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.wsBase = baseUrl.replace(/^http/, 'ws')
  }

  /** POST one client-request envelope; returns the narrowed RpcResult. */
  async rpc(method, payload, options = {}) {
    const timeoutMs = options.timeoutMs ?? 30000
    const rpcId = randomUUID()
    const body = JSON.stringify({ type: 'client-request', rpcId, method, payload })
    let response
    try {
      response = await fetch(this.baseUrl + '/api/' + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      return { ok: false, error: { code: 'internal', message: 'transport failure for ' + method + ': ' + String(error?.message ?? error), details: {} } }
    }
    if (!response.ok) {
      return { ok: false, error: { code: 'internal', message: 'transport failure for ' + method + ': HTTP ' + response.status, details: {} } }
    }
    let full
    try {
      full = await response.json()
    } catch (error) {
      return { ok: false, error: { code: 'internal', message: 'non-JSON response for ' + method, details: {} } }
    }
    if (full?.type !== 'server-response' || typeof full.result !== 'object' || full.result === null) {
      return { ok: false, error: { code: 'internal', message: 'malformed server-response for ' + method, details: {} } }
    }
    return full.result
  }

  /** POST one client-response envelope (answers approval/question frames). */
  async respond(rpcId, result) {
    try {
      const response = await fetch(this.baseUrl + '/api/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-response', rpcId, result }),
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) return { accepted: false, reason: 'http-' + response.status }
      return await response.json()
    } catch (error) {
      return { accepted: false, reason: String(error?.message ?? error) }
    }
  }

  /** Liveness/identity probe; throws a human-readable error when DSH is down. */
  async requireHost() {
    const result = await this.rpc('host.describe', {}, { timeoutMs: 8000 })
    if (!result.ok) throw new Error('cannot reach DSH at ' + this.baseUrl + ' (' + result.error.message + '). Is the DSH web service running?')
    return result.value
  }

  openMux() {
    return new WebSocket(this.wsBase + '/api/events.mux')
  }
}

// ---------------------------------------------------------------------------
// Session resolution
// ---------------------------------------------------------------------------

/** Create-or-reopen by id; create fresh; or resume the latest non-blank session. */
async function resolveSession(client, opts) {
  // Explicit id: probe existence via session.history (works for cold sessions
  // too), then create with the SAME id when absent — DSH honors sessionId in
  // session.create, which is what OpenAlice's assignsSessionId flow relies on.
  if (opts.sessionId) {
    const probe = await client.rpc('session.history', { sessionId: opts.sessionId, maxMessages: 1 })
    if (probe.ok) return { sessionId: opts.sessionId, resumed: true }
    if (probe.error.code !== 'session-not-found') {
      process.stderr.write('[dsh-bridge] warning: session probe failed (' + probe.error.message + '); trying session.create\n')
    }
    const created = await client.rpc('session.create', { sessionId: opts.sessionId, cwd: opts.cwd })
    if (!created.ok) throw new Error('session.create failed: ' + created.error.message)
    return { sessionId: created.value.sessionId, resumed: false }
  }

  if (opts.continueLast) {
    const list = await client.rpc('session.list', {})
    if (list.ok) {
      const candidates = list.value.items
        .filter((item) => item.blank === false)
        .sort((a, b) => b.updatedAt - a.updatedAt)
      if (candidates.length > 0) return { sessionId: candidates[0].sessionId, resumed: true }
    }
    // Nothing to resume → fall through to a fresh session.
  }

  const created = await client.rpc('session.create', { cwd: opts.cwd })
  if (!created.ok) throw new Error('session.create failed: ' + created.error.message)
  return { sessionId: created.value.sessionId, resumed: false }
}
// ---------------------------------------------------------------------------
// Output writers (text mode vs JSONL mode)
// ---------------------------------------------------------------------------

/** Extract plain text from an assistant message's content blocks. */
function blocksToText(content) {
  if (!Array.isArray(content)) return ''
  return content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('')
}

function makeWriters(opts) {
  if (opts.json) {
    return {
      emit(event) { process.stdout.write(JSON.stringify(event) + '\n') },
      delta(text) { this.emit({ type: 'assistant_delta', text }) },
      note(text) { this.emit({ type: 'note', text }) },
      flushLine() {},
    }
  }
  let pendingNewline = false
  return {
    emit(event) { process.stderr.write('[' + event.type + '] ' + JSON.stringify(event) + '\n') },
    delta(text) { pendingNewline = !text.endsWith('\n'); process.stdout.write(text) },
    note(text) { process.stderr.write(text + '\n') },
    flushLine() { if (pendingNewline) { process.stdout.write('\n'); pendingNewline = false } },
  }
}

// ---------------------------------------------------------------------------
// Turn lifecycle on the mux downlink
// ---------------------------------------------------------------------------

/**
 * Run one prompt to its turn boundary.
 *
 * Lifecycle: session.prompt (mode queue) → first turn/start after acceptance
 * is OUR turn → stream assistant/chunk text deltas → turn/end closes it.
 * Approval/question frames for this session are answered inline (TTY prompt or
 * --approve-all); headless callers without a TTY are warned on stderr and the
 * turn waits for an answer from another client (the DSH web UI).
 */
async function runTurn(client, writers, sessionId, text, opts, interactive) {
  const startedAt = Date.now()

  let pendingTurn = null          // turn number of our prompt, once started
  let lastSeenTurn = -1           // highest turn number observed so far
  let lastSeenTurnBeforeSend = -1 // snapshot at send time (attribution fence)
  let promptSent = false          // gate turn attribution against foreign turns
  let lastAssistantText = ''
  let turnReason = null
  let finished = false
  let wsDead = null               // set when the downlink dies mid-turn
  let resolveDone
  const done = new Promise((resolve) => { resolveDone = resolve })

  const pendingApprovals = new Map()   // approvalId → entry
  let askUi = null                     // readline interface while asking

  const ws = client.openMux()
  let wsOpened = false

  const closeAll = () => {
    try { if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close() } catch {}
    if (askUi) { try { askUi.close() } catch {}; askUi = null }
  }

  async function answerApproval(entry, outcome) {
    const receipt = await client.respond(entry.rpcId, {
      ok: true,
      value: { sessionId, approvalId: entry.approvalId, outcome },
    })
    if (!receipt.accepted) writers.note('[dsh-bridge] approval response not accepted: ' + receipt.reason)
  }

  async function handleApprovalRequested(frame, envelopeRpcId) {
    const entry = { rpcId: envelopeRpcId, approvalId: frame.approvalId, toolName: frame.toolName, reason: frame.reason }
    pendingApprovals.set(frame.approvalId, entry)
    if (writers.emit) writers.emit({ type: 'approval_requested', approvalId: frame.approvalId, toolName: frame.toolName, reason: frame.reason ?? null })
    if (opts.approveAll) {
      writers.note('[dsh-bridge] auto-approving tool "' + frame.toolName + '" (--approve-all)')
      pendingApprovals.delete(frame.approvalId)
      await answerApproval(entry, 'allowed-once')
      return
    }
    if (interactive && process.stdin.isTTY) {
      writers.flushLine()
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true })
      askUi = rl
      try {
        const answer = await rl.question('[dsh-bridge] approval: allow tool "' + frame.toolName + '"?' + (frame.reason ? ' (' + frame.reason + ')' : '') + ' [y/N] ')
        const allowed = /^y(es)?$/i.test(answer.trim())
        pendingApprovals.delete(frame.approvalId)
        await answerApproval(entry, allowed ? 'allowed-once' : 'rejected')
        writers.note('[dsh-bridge] approval ' + (allowed ? 'allowed' : 'rejected') + ': ' + frame.toolName)
      } finally {
        try { rl.close() } catch {}
        if (askUi === rl) askUi = null
      }
      return
    }
    writers.note('[dsh-bridge] tool "' + frame.toolName + '" requests approval; no interactive TTY — the turn will wait. Use --approve-all or answer in the DSH web UI.')
  }

  async function handleQuestionRequested(frame, envelopeRpcId) {
    if (writers.emit) writers.emit({ type: 'question_requested', questions: frame.questions })
    if (interactive && process.stdin.isTTY) {
      writers.flushLine()
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true })
      askUi = rl
      const answers = []
      try {
        for (const q of frame.questions) {
          const hint = q.options?.length ? ' (' + q.options.map((o) => o.label).join(' | ') + ')' : ''
          const reply = await rl.question('[dsh-bridge] question' + (q.header ? ' [' + q.header + ']' : '') + ': ' + q.question + hint + '\n> ')
          const trimmed = reply.trim()
          const selected = q.options?.map((o) => o.label).includes(trimmed) ? [trimmed] : []
          answers.push({ id: q.id, selected, ...(selected.length === 0 && trimmed ? { custom: trimmed } : {}) })
        }
      } finally {
        try { rl.close() } catch {}
        if (askUi === rl) askUi = null
      }
      const receipt = await client.respond(envelopeRpcId, { ok: true, value: { sessionId, answer: { answers } } })
      if (!receipt.accepted) writers.note('[dsh-bridge] question answer not accepted: ' + receipt.reason)
      return
    }
    writers.note('[dsh-bridge] the agent asked a question; no interactive TTY — the turn will wait. Answer in the DSH web UI.')
  }

  ws.addEventListener('open', () => { wsOpened = true })
  ws.addEventListener('error', () => { /* 'close' carries the outcome */ })
  ws.addEventListener('close', () => {
    if (!finished) {
      wsDead = wsOpened ? 'the DSH event stream closed mid-turn' : 'could not open the DSH event stream (WebSocket /api/events.mux)'
      resolveDone()
    }
  })

  ws.addEventListener('message', async (event) => {
    let envelope
    try {
      envelope = JSON.parse(String(event.data))
    } catch { return }
    if (envelope?.type !== 'server-request' || typeof envelope.payload !== 'object' || envelope.payload === null) return
    const frame = envelope.payload
    if (frame.sessionId !== undefined && frame.sessionId !== sessionId) return

    if (frame.type === 'session/event') {
      const ev = frame.event
      switch (ev?.type) {
        case 'assistant/chunk': {
          const chunk = ev.data?.chunk
          if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') writers.delta(chunk.text)
          else if (chunk?.type === 'reasoning-delta' && opts.showReasoning && typeof chunk.text === 'string') writers.delta(chunk.text)
          break
        }
        case 'assistant/message': {
          const messageText = blocksToText(ev.data?.message?.content)
          if (messageText) lastAssistantText = messageText
          writers.emit({
            type: 'message',
            role: 'assistant',
            text: messageText,
            toolCalls: (ev.data?.message?.content ?? []).filter((b) => b?.type === 'tool-call').map((b) => ({ name: b.name, callId: b.callId })),
          })
          break
        }
        case 'tool/call': {
          if (opts.json) writers.emit({ type: 'tool', phase: 'call', name: ev.data?.name, callId: ev.data?.callId })
          else writers.note('[tool] ' + (ev.data?.name ?? 'unknown'))
          break
        }
        case 'tool/result': {
          const isError = ev.data?.message?.content?.some((b) => b?.type === 'tool-result' && b.isError) ?? false
          writers.emit({ type: 'tool', phase: 'result', callId: ev.data?.message?.source?.callId ?? null, isError })
          break
        }
        case 'turn/start': {
          if (typeof ev.data?.turn === 'number') lastSeenTurn = Math.max(lastSeenTurn, ev.data.turn)
          if (promptSent && pendingTurn === null && ev.data?.turn > lastSeenTurnBeforeSend)
            pendingTurn = ev.data?.turn
          writers.emit({ type: 'turn_start', turn: ev.data?.turn })
          break
        }
        case 'turn/end': {
          if (typeof ev.data?.turn === 'number' && !promptSent) lastSeenTurn = Math.max(lastSeenTurn, ev.data.turn)
          writers.emit({ type: 'turn_end', turn: ev.data?.turn, reason: ev.data?.reason ?? null })
          if (pendingTurn !== null && ev.data?.turn === pendingTurn) {
            turnReason = ev.data?.reason ?? { kind: 'completed' }
            finished = true
            resolveDone()
          }
          break
        }
        case 'llm/retry': {
          writers.note('[dsh-bridge] model retry ' + (ev.data?.retry ?? 1) + '/' + (ev.data?.maxRetries ?? '?') + ': ' + (ev.data?.failure?.message ?? ''))
          break
        }
        default: break
      }
      return
    }
    switch (frame.type) {
      case 'approval/requested': await handleApprovalRequested(frame, envelope.rpcId); break
      case 'approval/resolved': pendingApprovals.delete(frame.approvalId); break
      case 'question/requested': await handleQuestionRequested(frame, envelope.rpcId); break
      case 'stream/error': writers.note('[dsh-bridge] stream error: ' + (frame.error?.message ?? JSON.stringify(frame.error))); break
      default: break
    }
  })

  // Wait for the downlink to establish before prompting, so no early frame
  // is missed (the prompt itself is only sent after 'open').
  const openDeadline = Date.now() + 10000
  while (!wsOpened && !wsDead && Date.now() < openDeadline) await new Promise((r) => setTimeout(r, 25))
  if (wsDead) { closeAll(); throw new Error(wsDead) }

  // Send the prompt. session-not-found (session vanished between resolve and
  // prompt) is handed back to the caller for one recreate-and-retry.
  // Attribution race rules: turn numbers are per-session and monotonic. Our
  // queued prompt's turn is the first turn/start strictly after the send
  // point, so snapshot lastSeenTurn atomically with the send and ignore every
  // foreign turn/start ≤ it (e.g. a still-running turn of the same session).
  // promptSent flips BEFORE the fetch resolves because with mode "queue" our
  // turn can start while the acceptance response is still in flight.
  lastSeenTurnBeforeSend = lastSeenTurn
  promptSent = true
  const promptResult = await client.rpc('session.prompt', {
    sessionId,
    mode: 'queue',
    content: [{ type: 'text', text }],
  }, { timeoutMs: 30000 })
  if (!promptResult.ok) {
    closeAll()
    if (promptResult.error.code === 'session-not-found') return { notFound: true }
    throw new Error('session.prompt rejected: ' + promptResult.error.message)
  }
  writers.emit({ type: 'prompt_accepted', sessionId })

  await done
  closeAll()
  if (wsDead && !finished) throw new Error(wsDead)

  writers.flushLine()
  const kind = turnReason?.kind ?? 'completed'
  writers.emit({
    type: 'result',
    subtype: kind,
    ok: kind === 'completed',
    text: lastAssistantText,
    durationMs: Date.now() - startedAt,
  })
  if (!opts.json) {
    if (kind === 'error') writers.note('[dsh-bridge] turn failed: ' + (turnReason?.error?.message ?? 'model error'))
    else if (kind === 'aborted') writers.note('[dsh-bridge] turn aborted')
  }
  return { notFound: false, ok: kind === 'completed', reason: turnReason, text: lastAssistantText }
}

/** Prompt with one session-not-found retry: recreate the session, re-announce. */
async function promptWithRecovery(client, writers, state, text, opts, interactive) {
  const first = await runTurn(client, writers, state.sessionId, text, opts, interactive)
  if (!first.notFound) return first
  writers.note('[dsh-bridge] session "' + state.sessionId + '" not found; creating a new session')
  const created = await client.rpc('session.create', { cwd: opts.cwd })
  if (!created.ok) throw new Error('session.create failed: ' + created.error.message)
  state.sessionId = created.value.sessionId
  state.resumed = false
  writers.emit({ type: 'session', id: state.sessionId, resumed: false, recreated: true })
  const second = await runTurn(client, writers, state.sessionId, text, opts, interactive)
  if (second.notFound) throw new Error('session disappeared twice in a row')
  return second
}
// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function readAllStdin() {
  return await new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => { data += chunk })
    process.stdin.on('end', () => resolve(data))
  })
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (typeof WebSocket === 'undefined') fail('this Node runtime has no global WebSocket; use Node >= 22')

  const client = new DshClient(opts.dshUrl)

  let host
  try {
    host = await client.requireHost()
  } catch (error) {
    fail(error.message)
  }
  process.stderr.write('[dsh-bridge] connected to DSH ' + host.version + ' (' + (host.provider ?? '?') + '/' + (host.model ?? '?') + ') at ' + opts.dshUrl + '\n')

  const writers = makeWriters(opts)

  let state
  try {
    state = await resolveSession(client, opts)
  } catch (error) {
    fail(error.message)
  }

  // Line 1: the session announcement OpenAlice captures.
  process.stdout.write(JSON.stringify({ type: 'session', id: state.sessionId, resumed: state.resumed }) + '\n')

  const headlessPrompt = opts.promptStdin ? (await readAllStdin()).trim() : opts.prompt

  if (opts.headless) {
    if (!headlessPrompt) fail('empty prompt')
    let exitCode = 0
    try {
      const result = await promptWithRecovery(client, writers, state, headlessPrompt, opts, false)
      exitCode = result.ok ? 0 : 1
    } catch (error) {
      writers.emit({ type: 'error', message: error.message })
      if (!opts.json) writers.note('[dsh-bridge] ' + error.message)
      exitCode = 1
    }
    process.exit(exitCode)
  }

  // Interactive REPL: one prompt per stdin line.
  const tty = process.stdin.isTTY
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: tty })

  const onSigint = async () => {
    process.stderr.write('\n[dsh-bridge] interrupting turn (session.cancel)…\n')
    try { await client.rpc('session.cancel', { sessionId: state.sessionId }, { timeoutMs: 5000 }) } catch {}
    process.exit(130)
  }
  process.on('SIGINT', onSigint)

  const promptMarker = () => { if (tty) process.stderr.write('you> ') }
  promptMarker()
  for await (const line of rl) {
    const text = line.trim()
    if (!text) { promptMarker(); continue }
    try {
      await promptWithRecovery(client, writers, state, text, opts, true)
    } catch (error) {
      writers.note('[dsh-bridge] ' + error.message)
    }
    promptMarker()
  }
  rl.close()
  process.stderr.write('\n[dsh-bridge] stdin closed; bye\n')
  process.exit(0)
}

main().catch((error) => fail(error?.stack ?? String(error)))

