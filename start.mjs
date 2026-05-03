#!/usr/bin/env node
import { spawn } from 'child_process';

// Parse CLI flags
const args = process.argv.slice(2);
let proxyPort = '3001';
let uiPort = '5173';

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--proxy-port' || args[i] === '-p') && args[i + 1]) {
    proxyPort = args[++i];
  } else if ((args[i] === '--ui-port' || args[i] === '-u') && args[i + 1]) {
    uiPort = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Usage: npm start -- [options]

Options:
  --proxy-port, -p <port>  Proxy server port (default: 3001)
  --ui-port, -u <port>     Vite dev server port (default: 5173)
  --help, -h               Show this help
`);
    process.exit(0);
  }
}

const proxyUrl = `http://localhost:${proxyPort}`;
const allowedOrigins = `http://localhost:${uiPort}`;

console.log(`Starting A2A Agent Chat...`);
console.log(`  UI:    http://localhost:${uiPort}`);
console.log(`  Proxy: ${proxyUrl}`);
console.log('');

// Start proxy
const proxy = spawn('node', ['proxy-server.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: proxyPort, ALLOWED_ORIGINS: allowedOrigins },
});

// Start Vite
const vite = spawn('npx', ['vite', '--port', uiPort], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_PORT: uiPort,
    VITE_PROXY_URL: `${proxyUrl}/proxy`,
    VITE_PROXY_BASE_URL: proxyUrl,
  },
});

// Handle exit
function cleanup() {
  proxy.kill();
  vite.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

proxy.on('exit', (code) => {
  if (code) console.error(`Proxy exited with code ${code}`);
  vite.kill();
  process.exit(code || 0);
});

vite.on('exit', (code) => {
  if (code) console.error(`Vite exited with code ${code}`);
  proxy.kill();
  process.exit(code || 0);
});
