const fs = require('fs')
const path = require('path')
const enquirer = require('enquirer')

// Add readline for fallback input
const readline = require('readline')

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
}

const METHODS = ['get', 'post', 'put', 'delete', 'patch']
const routesDir = path.join(__dirname, '..', 'routes')

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`)
}

function selectMethod() {
  log('magenta', '\n🚀 Create New Route Handler\n')
  log('gray', 'Use ← → arrows to select, Enter to confirm\n')

  return new Promise((resolve) => {
    let selected = 0

    function render() {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      const display = METHODS.map((m, i) =>
        i === selected
          ? `${colors.cyan}${colors.bright}[ ${m.toUpperCase()} ]${colors.reset}`
          : `${colors.gray}  ${m.toUpperCase()}  ${colors.reset}`
      ).join('')
      process.stdout.write(`  Method: ${display}`)
    }

    render()

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    function onKey(key) {
      if (key === '\u001b[C') {
        selected = (selected + 1) % METHODS.length
        render()
      } else if (key === '\u001b[D') {
        selected = (selected - 1 + METHODS.length) % METHODS.length
        render()
      } else if (key === '\r') {
        process.stdout.write('\n')
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', onKey)
        resolve(METHODS[selected])
      } else if (key === '\u0003') {
        process.stdout.write('\n')
        process.stdin.setRawMode(false)
        process.stdin.pause()
        log('yellow', '\n⏭️  Cancelled\n')
        process.exit(0)
      }
    }

    process.stdin.on('data', onKey)
  })
}

async function selectPath() {
  return navigateToPath(routesDir)
}

const OPT_CREATE = 'create route'
const OPT_NEWDIR = 'new folder'
const OPT_EXIT = 'go back'

async function navigateToPath(currentDir) {
  const existingDirs = []

  try {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    entries.forEach((entry) => {
      if (entry.isDirectory()) existingDirs.push(entry.name)
    })
    existingDirs.sort()
  } catch (err) {
    // Directory doesn't exist yet
  }

  const choices = [
    ...existingDirs.map((dir) => `${dir}/`),
    OPT_CREATE,
    OPT_NEWDIR,
    ...(currentDir !== routesDir ? [OPT_EXIT] : []),
  ]

  const displayPath = path.relative(routesDir, currentDir) || 'routes/'
  const { choice } = await enquirer.prompt({
    type: 'select',
    name: 'choice',
    message: `Select path (${displayPath}):`,
    choices,
    prefix: '📁',
  })

  if (choice === OPT_CREATE) {
    return currentDir
  }

  if (choice === OPT_EXIT) {
    return navigateToPath(path.dirname(currentDir))
  }

  if (choice === OPT_NEWDIR) {
    return askFolderName(currentDir)
  }

  // Directory selected — choice ends with '/'
  const dirName = choice.slice(0, -1)
  return navigateToPath(path.join(currentDir, dirName))
}

function askFolderName(currentDir) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    process.stdout.write(`${colors.cyan}📍 Folder name:${colors.reset}\n> `)

    rl.once('line', (folderName) => {
      rl.close()

      if (!folderName || !folderName.trim()) {
        log('red', 'Folder name cannot be empty')
        setTimeout(() => navigateToPath(currentDir).then(resolve), 100)
        return
      }

      if (folderName.includes('/') || folderName.includes('\\')) {
        log('red', 'Folder name cannot contain slashes')
        setTimeout(() => navigateToPath(currentDir).then(resolve), 100)
        return
      }

      const newDir = path.join(currentDir, folderName.trim())
      setTimeout(() => navigateToPath(newDir).then(resolve), 100)
    })
  })
}

async function previewAndConfirm(method, targetDir) {
  const relativePath = path.relative(routesDir, targetDir)
  const apiPath = `domain.com/${relativePath.replace(/\\/g, '/')}`

  log('cyan', `\n📋 Preview:`)
  log('yellow', `  API: ${apiPath}`)
  log('yellow', `  Method: ${method.toUpperCase()}`)
  log('yellow', `  File: ${path.join(relativePath, `${method}.js`)}`)

  const { confirmed } = await enquirer.prompt({
    type: 'confirm',
    name: 'confirmed',
    message: 'Create this route?',
    initial: true,
  })

  return confirmed
}

async function main() {
  try {
    if (!fs.existsSync(routesDir)) {
      log('red', `❌ Routes directory not found at ${routesDir}`)
      process.exit(1)
    }

    // Remove any buffered input
    process.stdin.removeAllListeners('keypress')

    // Step 1: Select method
    const method = await selectMethod()

    // Step 2: Select or create path
    const targetDir = await selectPath()

    // Step 3: Preview and confirm
    const confirmed = await previewAndConfirm(method, targetDir)

    if (!confirmed) {
      log('yellow', '\n⏭️  Cancelled\n')
      process.exit(0)
    }

    // Step 4: Create directory
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
      log('green', `✅ Created directory`)
    }

    // Step 5: Copy template
    const templatePath = path.join(__dirname, 'template', `${method}.js`)
    const routeFile = path.join(targetDir, `${method}.js`)

    if (!fs.existsSync(templatePath)) {
      log('red', `❌ Template not found: ${templatePath}`)
      process.exit(1)
    }

    if (fs.existsSync(routeFile)) {
      log('red', `❌ File already exists: ${routeFile}`)
      process.exit(1)
    }

    const template = fs.readFileSync(templatePath, 'utf8')
    fs.writeFileSync(routeFile, template)

    const relativePath = path.relative(process.cwd(), routeFile)
    log('green', `\n✅ Route created successfully!`)
    log('cyan', `📄 File: ${relativePath}`)
    log('bright', `🎉 Ready to use!\n`)
  } catch (err) {
    if (err.message === 'User force closed the prompt' || err.message.includes('aborted')) {
      log('yellow', '\n⏭️  Cancelled\n')
      process.exit(0)
    }
    log('red', `\n❌ Error: ${err.message}\n`)
    console.error(err)
    process.exit(1)
  }
}

main()
