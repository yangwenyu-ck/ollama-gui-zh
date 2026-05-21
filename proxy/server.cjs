const http = require('http')
const fs = require('fs')
const path = require('path')

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '11435')
const DATA_DIR = path.join(__dirname, 'data')
const LOG_FILE = path.join(DATA_DIR, 'inference-logs.json')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

let inferenceLogs = []
let logIdCounter = 0
let defaultModel = ''

function loadLogs() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'))
      inferenceLogs = data.logs || []
      logIdCounter = data.nextId || inferenceLogs.length
    }
  } catch (e) {
    console.error('Failed to load logs:', e.message)
    inferenceLogs = []
  }
}

function saveLogs() {
  try {
    const toSave = inferenceLogs.slice(-5000)
    fs.writeFileSync(LOG_FILE, JSON.stringify({ logs: toSave, nextId: logIdCounter }, null, 2))
  } catch (e) {
    console.error('Failed to save logs:', e.message)
  }
}

loadLogs()
fetchDefaultModel()

setInterval(saveLogs, 10000)

process.on('SIGINT', () => { saveLogs(); process.exit(0) })
process.on('SIGTERM', () => { saveLogs(); process.exit(0) })

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function sendJSON(res, statusCode, data) {
  setCorsHeaders(res)
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function extractContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text || '')
      .join('')
  }
  return content || ''
}

function fetchDefaultModel() {
  http.get(`${OLLAMA_HOST}/api/tags`, (res) => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      try {
        const tags = JSON.parse(data)
        if (tags.models && tags.models.length > 0) {
          defaultModel = tags.models[0].name
          console.log('[proxy] Default model set to:', defaultModel)
        }
      } catch (e) {}
    })
  }).on('error', () => {})
}

function openaiToOllamaRequest(openaiBody) {
  const ollamaMessages = (openaiBody.messages || []).map(msg => ({
    role: msg.role,
    content: extractContent(msg.content),
  }))

  return {
    model: openaiBody.model || defaultModel,
    messages: ollamaMessages,
    stream: openaiBody.stream !== false,
    options: {
      temperature: openaiBody.temperature,
      top_p: openaiBody.top_p,
      top_k: openaiBody.top_k,
      num_predict: openaiBody.max_tokens,
      stop: openaiBody.stop,
    },
  }
}

function ollamaChunkToOpenAI(ollamaChunk, model, requestId) {
  if (ollamaChunk.done) {
    return {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: {},
        logprobs: null,
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: ollamaChunk.prompt_eval_count || 0,
        completion_tokens: ollamaChunk.eval_count || 0,
        total_tokens: (ollamaChunk.prompt_eval_count || 0) + (ollamaChunk.eval_count || 0),
      },
    }
  }

  return {
    id: requestId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      delta: {
        content: ollamaChunk.message?.content || '',
      },
      logprobs: null,
      finish_reason: null,
    }],
  }
}

function ollamaDoneToOpenAI(ollamaChunk, model, requestId) {
  return {
    id: requestId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: '',
      },
      logprobs: null,
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: ollamaChunk.prompt_eval_count || 0,
      completion_tokens: ollamaChunk.eval_count || 0,
      total_tokens: (ollamaChunk.prompt_eval_count || 0) + (ollamaChunk.eval_count || 0),
    },
  }
}

function generateId() {
  return 'chatcmpl-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function handleOpenAICompat(req, res, pathname) {
  if (pathname.endsWith('/v1/models') || pathname.endsWith('/models')) {
    http.get(`${OLLAMA_HOST}/api/tags`, (proxyRes) => {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        try {
          const tags = JSON.parse(data)
          const models = (tags.models || []).map(m => ({
            id: m.name,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'ollama',
          }))
          sendJSON(res, 200, { object: 'list', data: models })
        } catch (e) {
          sendJSON(res, 200, { object: 'list', data: [] })
        }
      })
    }).on('error', (e) => {
      sendJSON(res, 502, { error: { message: 'Cannot connect to Ollama', type: 'proxy_error' } })
    })
    return true
  }

  if (pathname.endsWith('/chat/completions')) {
    handleChatCompletions(req, res)
    return true
  }

  return false
}

async function handleChatCompletions(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    res.writeHead(204)
    res.end()
    return
  }

  const openaiBody = await parseBody(req)
  console.log('[openai-compat] Incoming request:', JSON.stringify(openaiBody, null, 2))
  const ollamaBody = openaiToOllamaRequest(openaiBody)
  console.log('[openai-compat] Converted to Ollama:', JSON.stringify(ollamaBody, null, 2))
  const requestId = generateId()
  const isStream = ollamaBody.stream
  const startTime = Date.now()

  const ollamaUrl = new URL('/api/chat', OLLAMA_HOST)

  const proxyReqOptions = {
    hostname: ollamaUrl.hostname,
    port: ollamaUrl.port,
    path: ollamaUrl.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }

  const proxyReq = http.request(proxyReqOptions, (proxyRes) => {
    console.log('[openai-compat] Ollama response status:', proxyRes.statusCode)
    setCorsHeaders(res)

    if (isStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      let fullContent = ''
      let buffer = ''

      proxyRes.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const ollamaChunk = JSON.parse(line)
            if (ollamaChunk.message?.content) {
              fullContent += ollamaChunk.message.content
            }
            const openaiChunk = ollamaChunkToOpenAI(ollamaChunk, ollamaBody.model, requestId)
            res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`)

            if (ollamaChunk.done) {
              res.write('data: [DONE]\n\n')
              res.end()

              const evalDurationSec = (ollamaChunk.eval_duration || 0) / 1_000_000_000
              const completionTokens = ollamaChunk.eval_count || 0
              const tokensPerSecond = evalDurationSec > 0 ? parseFloat((completionTokens / evalDurationSec).toFixed(1)) : 0

              const logEntry = {
                id: ++logIdCounter,
                timestamp: new Date().toISOString(),
                model: ollamaBody.model,
                promptTokens: ollamaChunk.prompt_eval_count || 0,
                completionTokens,
                totalTokens: (ollamaChunk.prompt_eval_count || 0) + completionTokens,
                totalDuration: (ollamaChunk.total_duration || 0) / 1_000_000,
                evalDuration: evalDurationSec * 1000,
                loadDuration: (ollamaChunk.load_duration || 0) / 1_000_000,
                tokensPerSecond,
                status: 'success',
              }

              inferenceLogs.push(logEntry)
              if (inferenceLogs.length > 5000) {
                inferenceLogs = inferenceLogs.slice(-5000)
              }

              console.log(
                `[${logEntry.timestamp}] ${logEntry.model} | ` +
                `${logEntry.completionTokens} tokens | ` +
                `${logEntry.tokensPerSecond} tok/s | ` +
                `${logEntry.totalDuration.toFixed(0)}ms`
              )
            }
          } catch (e) {
            console.error('[openai-compat] Failed to parse Ollama chunk:', line.substring(0, 200), e.message)
          }
        }
      })

      proxyRes.on('end', () => {
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n')
          res.end()
        }
      })
    } else {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        try {
          const ollamaResponse = JSON.parse(data)
          const openaiResponse = {
            id: requestId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: ollamaBody.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: ollamaResponse.message?.content || '',
              },
              logprobs: null,
              finish_reason: 'stop',
            }],
            usage: {
              prompt_tokens: ollamaResponse.prompt_eval_count || 0,
              completion_tokens: ollamaResponse.eval_count || 0,
              total_tokens: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0),
            },
          }
          sendJSON(res, 200, openaiResponse)

          const evalDurationSec = (ollamaResponse.eval_duration || 0) / 1_000_000_000
          const completionTokens = ollamaResponse.eval_count || 0
          const tokensPerSecond = evalDurationSec > 0 ? parseFloat((completionTokens / evalDurationSec).toFixed(1)) : 0

          const logEntry = {
            id: ++logIdCounter,
            timestamp: new Date().toISOString(),
            model: ollamaBody.model,
            promptTokens: ollamaResponse.prompt_eval_count || 0,
            completionTokens,
            totalTokens: (ollamaResponse.prompt_eval_count || 0) + completionTokens,
            totalDuration: (ollamaResponse.total_duration || 0) / 1_000_000,
            evalDuration: evalDurationSec * 1000,
            loadDuration: (ollamaResponse.load_duration || 0) / 1_000_000,
            tokensPerSecond,
            status: 'success',
          }

          inferenceLogs.push(logEntry)
          if (inferenceLogs.length > 5000) {
            inferenceLogs = inferenceLogs.slice(-5000)
          }

          console.log(
            `[${logEntry.timestamp}] ${logEntry.model} | ` +
            `${logEntry.completionTokens} tokens | ` +
            `${logEntry.tokensPerSecond} tok/s | ` +
            `${logEntry.totalDuration.toFixed(0)}ms`
          )
        } catch (e) {
          sendJSON(res, 500, { error: { message: 'Failed to parse Ollama response', type: 'proxy_error' } })
        }
      })
    }
  })

  proxyReq.on('error', (e) => {
    console.error('[openai-compat] Proxy error:', e.message)
    if (!res.headersSent) {
      sendJSON(res, 502, { error: { message: 'Cannot connect to Ollama', type: 'proxy_error', detail: e.message } })
    }
  })

  proxyReq.write(JSON.stringify(ollamaBody))
  proxyReq.end()
}

function handleMonitorAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PROXY_PORT}`)
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    res.writeHead(204)
    res.end()
    return true
  }

  if (pathname === '/monitor/logs') {
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const modelFilter = url.searchParams.get('model') || ''

    let filtered = inferenceLogs
    if (modelFilter) {
      filtered = filtered.filter(log => log.model.includes(modelFilter))
    }

    const total = filtered.length
    const start = Math.max(0, total - page * limit)
    const end = Math.max(0, total - (page - 1) * limit)
    const logs = filtered.slice(start, end).reverse()

    sendJSON(res, 200, {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
    return true
  }

  if (pathname === '/monitor/stats') {
    const totalCalls = inferenceLogs.length
    const totalTokens = inferenceLogs.reduce((sum, l) => sum + (l.completionTokens || 0), 0)
    const totalPromptTokens = inferenceLogs.reduce((sum, l) => sum + (l.promptTokens || 0), 0)
    const avgSpeed = totalCalls > 0
      ? (inferenceLogs.reduce((sum, l) => sum + (l.tokensPerSecond || 0), 0) / totalCalls).toFixed(1)
      : '0'
    const avgDuration = totalCalls > 0
      ? (inferenceLogs.reduce((sum, l) => sum + (l.totalDuration || 0), 0) / totalCalls / 1000).toFixed(2)
      : '0'

    const modelStats = {}
    inferenceLogs.forEach(log => {
      if (!modelStats[log.model]) {
        modelStats[log.model] = { calls: 0, totalTokens: 0, totalSpeed: 0, totalDuration: 0 }
      }
      modelStats[log.model].calls++
      modelStats[log.model].totalTokens += log.completionTokens || 0
      modelStats[log.model].totalSpeed += log.tokensPerSecond || 0
      modelStats[log.model].totalDuration += log.totalDuration || 0
    })

    const models = Object.entries(modelStats).map(([model, stats]) => ({
      model,
      calls: stats.calls,
      totalTokens: stats.totalTokens,
      avgSpeed: (stats.totalSpeed / stats.calls).toFixed(1),
      avgDuration: (stats.totalDuration / stats.calls / 1000).toFixed(2),
    })).sort((a, b) => b.calls - a.calls)

    sendJSON(res, 200, {
      totalCalls,
      totalTokens,
      totalPromptTokens,
      avgSpeed: parseFloat(avgSpeed),
      avgDuration: parseFloat(avgDuration),
      models,
    })
    return true
  }

  if (pathname === '/monitor/ps') {
    const target = `${OLLAMA_HOST}/api/ps`
    http.get(target, (proxyRes) => {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        setCorsHeaders(res)
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' })
        res.end(data)
      })
    }).on('error', (e) => {
      console.error('[proxy] /monitor/ps error:', e.message)
      sendJSON(res, 502, { error: 'Cannot connect to Ollama', detail: e.message })
    })
    return true
  }

  if (pathname === '/monitor/tags') {
    const target = `${OLLAMA_HOST}/api/tags`
    http.get(target, (proxyRes) => {
      let data = ''
      proxyRes.on('data', chunk => { data += chunk })
      proxyRes.on('end', () => {
        setCorsHeaders(res)
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' })
        res.end(data)
      })
    }).on('error', (e) => {
      sendJSON(res, 502, { error: 'Cannot connect to Ollama', detail: e.message })
    })
    return true
  }

  if (pathname === '/monitor/clear') {
    inferenceLogs = []
    logIdCounter = 0
    saveLogs()
    sendJSON(res, 200, { status: 'cleared' })
    return true
  }

  if (pathname === '/monitor/speed-trend') {
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const recent = inferenceLogs.slice(-limit).map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      model: log.model,
      tokensPerSecond: log.tokensPerSecond,
      completionTokens: log.completionTokens,
      totalDuration: log.totalDuration,
    }))
    sendJSON(res, 200, { trend: recent })
    return true
  }

  return false
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/monitor/')) {
    const handled = handleMonitorAPI(req, res)
    if (handled) return
  }

  const urlObj = new URL(req.url, `http://localhost:${PROXY_PORT}`)
  const pathname = urlObj.pathname

  if (pathname.includes('/models') || pathname.includes('/chat/completions')) {
    const handled = handleOpenAICompat(req, res, pathname)
    if (handled) return
  }

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    res.writeHead(204)
    res.end()
    return
  }

  const startTime = Date.now()
  const ollamaUrl = new URL(req.url, OLLAMA_HOST)

  const isChatEndpoint = req.url === '/api/chat'
  let requestBody = null

  if (isChatEndpoint) {
    requestBody = await parseBody(req)
  }

  const proxyReqOptions = {
    hostname: ollamaUrl.hostname,
    port: ollamaUrl.port,
    path: ollamaUrl.pathname,
    method: req.method,
    headers: { ...req.headers, host: ollamaUrl.host },
  }

  const proxyReq = http.request(proxyReqOptions, (proxyRes) => {
    setCorsHeaders(res)

    if (isChatEndpoint && requestBody) {
      let chunks = []

      proxyRes.on('data', (chunk) => {
        chunks.push(chunk)
        res.write(chunk)
      })

      proxyRes.on('end', () => {
        res.end()
        const rawBody = Buffer.concat(chunks).toString('utf-8')
        const lines = rawBody.split('\n').filter(l => l.trim())

        let lastChunk = null
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            if (parsed.done === true) {
              lastChunk = parsed
            }
          } catch (e) {}
        }

        if (lastChunk) {
          const evalDurationSec = (lastChunk.eval_duration || 0) / 1_000_000_000
          const completionTokens = lastChunk.eval_count || 0
          const tokensPerSecond = evalDurationSec > 0 ? parseFloat((completionTokens / evalDurationSec).toFixed(1)) : 0

          const logEntry = {
            id: ++logIdCounter,
            timestamp: new Date().toISOString(),
            model: lastChunk.model || requestBody.model || 'unknown',
            promptTokens: lastChunk.prompt_eval_count || 0,
            completionTokens,
            totalTokens: (lastChunk.prompt_eval_count || 0) + completionTokens,
            totalDuration: (lastChunk.total_duration || 0) / 1_000_000,
            evalDuration: evalDurationSec * 1000,
            loadDuration: (lastChunk.load_duration || 0) / 1_000_000,
            tokensPerSecond,
            status: 'success',
          }

          inferenceLogs.push(logEntry)
          if (inferenceLogs.length > 5000) {
            inferenceLogs = inferenceLogs.slice(-5000)
          }

          console.log(
            `[${logEntry.timestamp}] ${logEntry.model} | ` +
            `${logEntry.completionTokens} tokens | ` +
            `${logEntry.tokensPerSecond} tok/s | ` +
            `${logEntry.totalDuration.toFixed(0)}ms`
          )
        }
      })
    } else {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    }
  })

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message)
    if (!res.headersSent) {
      sendJSON(res, 502, { error: 'Cannot connect to Ollama', detail: e.message })
    }
  })

  if (isChatEndpoint && requestBody) {
    proxyReq.write(JSON.stringify(requestBody))
  } else {
    req.pipe(proxyReq, { end: true })
  }
})

server.listen(PROXY_PORT, () => {
  console.log(`\n  Ollama Proxy Server`)
  console.log(`  ===================`)
  console.log(`  Proxy:           http://localhost:${PROXY_PORT}`)
  console.log(`  Ollama:          ${OLLAMA_HOST}`)
  console.log(`  Monitor:         http://localhost:${PROXY_PORT}/monitor/stats`)
  console.log(`  OpenAI Compat:   http://localhost:${PROXY_PORT}/v1/chat/completions`)
  console.log(`  Models List:     http://localhost:${PROXY_PORT}/v1/models`)
  console.log(`  Logs:            ${LOG_FILE}\n`)
  console.log(`  Trae IDE 配置: http://localhost:${PROXY_PORT}`)
  console.log(`  API 格式: OpenAI Chat Completions 格式\n`)
})
