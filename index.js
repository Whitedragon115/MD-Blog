const express = require('express')
const path = require('path')

const app = express()
const PORT = 3000

app.use(express.json())

// Serve OpenAPI spec
app.use('/openapi.json', express.static(path.join(__dirname, 'docs', 'openapi.json')))

// Serve Scalar API docs UI
app.use('/docs', express.static(path.join(__dirname, 'docs')))

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`API docs available at http://localhost:${PORT}/docs`)
})
