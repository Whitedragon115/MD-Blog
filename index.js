const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 3000
const routesDir = path.join(__dirname, 'routes')

app.use(express.json())

// Serve OpenAPI spec
app.use('/openapi.json', express.static(path.join(__dirname, 'docs', 'openapi.json')))

// Serve Scalar API docs UI
app.use('/docs', express.static(path.join(__dirname, 'docs')))

function registerRoutes(dir) {
  if (!fs.existsSync(dir)) {
    return
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      registerRoutes(fullPath)
      continue
    }

    if (entry.isFile() && entry.name === 'route.js') {
      const relativePath = path.relative(routesDir, fullPath).replace(/\\/g, '/')
      const routePath = `/${relativePath}`

      const routeModule = require(fullPath)
      const handler = routeModule.default || routeModule

      if (typeof handler === 'function') {
        app.all(routePath, handler)
      } else if (handler && typeof handler === 'object') {
        app.use(routePath, handler)
      }

      console.log(`Registered route: ${routePath} -> ${fullPath}`)
    }
  }
}

registerRoutes(routesDir)

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`API docs available at http://localhost:${PORT}/docs`)
})
