const yaml = require('yaml')
const express = require('express')
const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
require('dotenv').config()

function loadConfig() {
  const configPath = path.join(__dirname, 'config.yml')

  if (!fs.existsSync(configPath)) {
    console.warn('config.yml not found, using defaults')
    return { server: { host: 'localhost', port: 3000 } }
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    return YAML.parse(raw) || {}
  } catch (err) {
    console.error('Failed to parse config.yml:', err.message)
    return { server: { host: 'localhost', port: 3000 } }
  }
}

const config = loadConfig()
const PORT = config.server?.port || process.env.PORT || 3000
const HOST = config.server?.host || process.env.HOST || 'localhost'
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''
const globalAuthEnabled = config.auth === undefined ? true : typeof config.auth === 'boolean' ? config.auth : config.auth?.enabled !== false

const app = express()
const routesDir = path.join(__dirname, 'routes')

app.use(express.json())

// Serve OpenAPI spec
app.use('/openapi.json', express.static(path.join(__dirname, 'docs', 'openapi.json')))

// Serve Scalar API docs UI
app.use('/docs', express.static(path.join(__dirname, 'docs')))

const METHOD_FILES = {
  'get.js': 'GET',
  'post.js': 'POST',
  'put.js': 'PUT',
  'delete.js': 'DELETE',
  'patch.js': 'PATCH',
}

const EXPRESS_METHODS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch',
}

function authMiddleware(req, res, next) {
  if (!AUTH_TOKEN) {
    return res.status(500).json({ message: 'AUTH_TOKEN is not configured' })
  }

  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : authorization

  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  next()
}

function registerRoutes(dir) {
  if (!fs.existsSync(dir)) return

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      registerRoutes(fullPath)
      continue
    }

    const method = METHOD_FILES[entry.name]
    if (!entry.isFile() || !method) continue

    const relativeDir = path.relative(routesDir, dir).replace(/\\/g, '/')
    const routePath = '/api/' + relativeDir
    const expressMethod = EXPRESS_METHODS[method]

    const routeModule = require(fullPath)
    const routeObject = routeModule && typeof routeModule === 'object' ? routeModule : {}
    const handler = routeObject?.[method] || routeObject?.default?.[method] || routeModule
    const routeAuthEnabled = globalAuthEnabled && routeObject.auth !== false && routeObject.default?.auth !== false

    if (typeof handler !== 'function' || !expressMethod || typeof app[expressMethod] !== 'function') {
      console.warn(`Skipped route: ${method} ${routePath} -> ${fullPath}`)
      continue
    }

    if (routeAuthEnabled) {
      app[expressMethod](routePath, authMiddleware, handler)
    } else {
      app[expressMethod](routePath, handler)
    }

    console.log(`Registered route: ${method.toUpperCase()} ${routePath} -> ${fullPath}`)
  }
}

registerRoutes(routesDir)

app.use((req, res) => {
  req.socket.destroy()
})

const server = app.listen(PORT, HOST, () => {

  console.log(`Server running at http://${HOST}:${PORT}`)
  console.log(`API docs available at http://${HOST}:${PORT}/docs`)

})

const sockets = new Set()

server.on('connection', (socket) => {
  sockets.add(socket)

  socket.on('close', () => {
    sockets.delete(socket)
  })
})

function shutdown(signal) {
  if (server.listening === false) {
    process.exit(0)
  }

  console.log(`\nReceived ${signal}. Shutting down server...`)

  for (const socket of sockets) {
    socket.destroy()
  }

  server.close((error) => {
    if (error) {
      console.error('Error during server shutdown', error)
      process.exit(1)
    }

    console.log('Server stopped')
    process.exit(0)
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))