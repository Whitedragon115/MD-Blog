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

const app = express()
const routesDir = path.join(__dirname, 'routes')

app.use(express.json())

// Serve OpenAPI spec
app.use('/openapi.json', express.static(path.join(__dirname, 'docs', 'openapi.json')))

// Serve Scalar API docs UI
app.use('/docs', express.static(path.join(__dirname, 'docs')))

const METHOD_FILES = {
  'route.js': 'get',
  'get.js': 'get',
  'post.js': 'post',
  'put.js': 'put',
  'delete.js': 'delete',
  'patch.js': 'patch',
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
    const routePath = '/' + relativeDir

    const handler = require(fullPath)
    app[method](routePath, handler)

    console.log(`Registered route: ${method.toUpperCase()} ${routePath} -> ${fullPath}`)
  }
}

registerRoutes(routesDir)

const server = app.listen(PORT, HOST, () => {

  console.log(`Server running at http://${HOST}:${PORT}`)
  console.log(`API docs available at http://${HOST}:${PORT}/docs`)

})

function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down server...`)

  server.close((error) => {
    if (error) {
      console.error('Error during server shutdown', error)
      process.exit(1)
    }

    console.log('Server stopped')
    process.exit(0)
  })

  setTimeout(() => {
    console.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))