import { spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './sites-env.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function findWranglerBin() {
  const directPath = path.join(projectRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (existsSync(directPath)) return directPath;

  const binPath = path.join(projectRoot, 'node_modules', '.bin', 'wrangler');
  if (existsSync(binPath)) return binPath;

  const binJsPath = path.join(projectRoot, 'node_modules', '.bin', 'wrangler.js');
  if (existsSync(binJsPath)) return binJsPath;

  const pnpmDir = path.join(projectRoot, 'node_modules', '.pnpm');
  if (existsSync(pnpmDir)) {
    try {
      const entries = readdirSync(pnpmDir);
      for (const entry of entries) {
        if (entry.startsWith('wrangler@')) {
          const candidate = path.join(pnpmDir, entry, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
          if (existsSync(candidate)) return candidate;
        }
      }
    } catch {}
  }

  return 'wrangler';
}

const wranglerBin = findWranglerBin();
const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3000';

console.log(`[start-server] Launching Wrangler from: ${wranglerBin}`);
console.log(`[start-server] Binding to ${host}:${port}`);

// Forward secrets and environment variables from container (Fly.io secrets) to Wrangler/workerd
const groqKey = process.env.GROQ_API_KEY || process.env.groq_api_key || process.env.GROQ_KEY || '';
const geminiKey = process.env.GEMINI_API_KEY || process.env.gemini_api_key || '';

const varsToForward = {};
if (groqKey) varsToForward['GROQ_API_KEY'] = groqKey;
if (geminiKey) varsToForward['GEMINI_API_KEY'] = geminiKey;

const isJs = wranglerBin.endsWith('.js');
const command = isJs ? process.execPath : wranglerBin;
const rawArgs = [
  'dev',
  '--config', 'dist/server/wrangler.json',
  '--local',
  '--persist-to', '.wrangler/state',
  '--ip', host,
  '--port', port,
  '--inspector-port', '0'
];

if (Object.keys(varsToForward).length > 0) {
  console.log(`[start-server] Forwarding secrets to Cloudflare Wrangler/workerd:`, Object.keys(varsToForward));

  // 1. Write .dev.vars in projectRoot and dist/server
  const devVarsContent = Object.entries(varsToForward)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join('\n') + '\n';

  try {
    writeFileSync(path.join(projectRoot, '.dev.vars'), devVarsContent);
    const distServerDir = path.join(projectRoot, 'dist', 'server');
    if (existsSync(distServerDir)) {
      writeFileSync(path.join(distServerDir, '.dev.vars'), devVarsContent);
    }
  } catch (err) {
    console.warn('[start-server] Notice writing .dev.vars:', err);
  }

  // 2. Inject into dist/server/wrangler.json
  try {
    const wranglerConfigPath = path.join(projectRoot, 'dist', 'server', 'wrangler.json');
    if (existsSync(wranglerConfigPath)) {
      const config = JSON.parse(readFileSync(wranglerConfigPath, 'utf8'));
      config.vars = { ...(config.vars || {}), ...varsToForward };
      writeFileSync(wranglerConfigPath, JSON.stringify(config, null, 2));
      console.log('[start-server] Injected secrets into dist/server/wrangler.json');
    }
  } catch (err) {
    console.warn('[start-server] Notice injecting wrangler.json:', err);
  }

  // 3. Append --var flags to rawArgs
  for (const [k, v] of Object.entries(varsToForward)) {
    rawArgs.push('--var', `${k}:${v}`);
  }
}

const args = isJs ? [wranglerBin, ...rawArgs] : rawArgs;

const child = spawn(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    HOST: host,
    PORT: port
  }
});

child.on('error', (err) => {
  console.error('[start-server] Failed to start Wrangler:', err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) {
      child.kill(sig);
    }
  });
}
