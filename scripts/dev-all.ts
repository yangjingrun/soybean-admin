#!/usr/bin/env node
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

const dbHost = process.env.DEV_DB_HOST || '127.0.0.1';
const dbPort = Number(process.env.DEV_DB_PORT || 5432);
const dbService = process.env.DEV_DB_SERVICE || 'postgres';
const waitTimeoutMs = Number(process.env.DEV_DB_WAIT_TIMEOUT || 30_000);

const children = new Set<ReturnType<typeof spawn>>();

/** Runs a setup command and stops immediately when it fails. */
function runStep(command: string, args: string[]) {
  console.log(`\n$ ${[command, ...args].join(' ')}`);

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

/** Starts a long-running dev process and keeps it attached to this terminal. */
function startProcess(name: string, command: string, args: string[]) {
  console.log(`\n[${name}] ${[command, ...args].join(' ')}`);

  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  children.add(child);

  child.on('exit', code => {
    children.delete(child);

    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      stopChildren();
      process.exit(code);
    }
  });
}

/** Picks the Docker Compose command available on the current machine. */
function getDockerComposeCommand(): [string, string[]] {
  const dockerCompose = spawnSync('docker', ['compose', 'version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32'
  });

  if (dockerCompose.status === 0) {
    return ['docker', ['compose']];
  }

  return ['docker-compose', []];
}

/** Waits until the local database port accepts TCP connections. */
function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const connect = () => {
      const socket = net.createConnection({ host, port });

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }

        setTimeout(connect, 500);
      });
    };

    connect();
  });
}

function stopChildren() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

async function main() {
  const [dockerCommand, dockerArgs] = getDockerComposeCommand();

  runStep(dockerCommand, [...dockerArgs, 'up', '-d', dbService]);
  console.log(`\nWaiting for database at ${dbHost}:${dbPort}...`);
  await waitForPort(dbHost, dbPort, waitTimeoutMs);

  runStep('pnpm', ['prisma', 'migrate', 'deploy']);
  runStep('pnpm', ['prisma', 'generate']);

  startProcess('server', 'pnpm', ['server:dev']);
  startProcess('frontend', 'pnpm', ['dev']);
}

process.once('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.once('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});

main().catch(error => {
  console.error(error.message);
  stopChildren();
  process.exit(1);
});
