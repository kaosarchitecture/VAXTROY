import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = 3788;
const base = `http://127.0.0.1:${port}`;
const dbPath = path.join(repoRoot, 'data', 'vaxtroy-happy.sqlite');

type ApiResult = { status: number; body: unknown };

function log(title: string, value: unknown): void {
  console.log(`\n===== ${title} =====`);
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

async function api(pathname: string, init?: RequestInit): Promise<ApiResult> {
  const response = await fetch(`${base}${pathname}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: response.status, body };
}

function startServer(): ChildProcess {
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/api/src/index.ts'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      VAXTROY_DB_PATH: dbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}

async function waitForHealth(child: ChildProcess): Promise<void> {
  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    if (child.exitCode !== null) {
      throw new Error(`API process exited ${child.exitCode}\n${stderr}`);
    }
    try {
      const health = await api('/api/health');
      if (health.status === 200) return;
    } catch {
      /* server still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${base}/api/health\n${stderr}`);
}

async function stopServer(child: ChildProcess): Promise<number> {
  if (child.exitCode !== null) return child.exitCode;
  child.kill('SIGTERM');
  const code = await new Promise<number>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 4_000);
    child.once('exit', (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode ?? 1);
    });
  });
  return code;
}

function assertStatus(result: ApiResult, expected: number, label: string): void {
  if (result.status !== expected) {
    throw new Error(`${label} expected HTTP ${expected} but got ${result.status}: ${JSON.stringify(result.body)}`);
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(dbPath + suffix, { force: true });
  }

  let child = startServer();
  try {
    await waitForHealth(child);
    const health = await api('/api/health');
    log('GET /api/health', health);
    assertStatus(health, 200, 'health');

    const floor = await api('/api/floor');
    log('GET /api/floor', floor);
    assertStatus(floor, 200, 'floor');

    const products = await api('/api/products');
    log('GET /api/products', products);
    assertStatus(products, 200, 'products');
    const productList = (products.body as { products: { id: string; priceKurus: number }[] }).products;
    const adana = productList.find((item) => item.id === 'product_adana');
    if (!adana) throw new Error('product_adana missing from seed');

    const opened = await api('/api/tables/table_01/tickets', { method: 'POST' });
    log('POST /api/tables/table_01/tickets', opened);
    assertStatus(opened, 201, 'open');
    const ticketId = (opened.body as { ticket: { id: string } }).ticket.id;

    const added = await api(`/api/tickets/${ticketId}/lines`, {
      method: 'POST',
      body: JSON.stringify({ productId: 'product_adana', quantity: 2 }),
    });
    log('POST /api/tickets/:id/lines', added);
    assertStatus(added, 201, 'add line');
    const addedTicket = (added.body as { ticket: { totalKurus: number; lines: { quantity: number }[] } }).ticket;
    if (addedTicket.totalKurus !== adana.priceKurus * 2) {
      throw new Error(`total ${addedTicket.totalKurus} != ${adana.priceKurus * 2}`);
    }
    if (addedTicket.lines[0]?.quantity !== 2) throw new Error('quantity was not stored');

    const beforeRestart = await api(`/api/tickets/${ticketId}`);
    log('GET /api/tickets/:id before restart', beforeRestart);
    assertStatus(beforeRestart, 200, 'ticket before restart');

    const firstExit = await stopServer(child);
    log('API process restart — first stop exit code', { exitCode: firstExit });

    child = startServer();
    await waitForHealth(child);
    const afterRestart = await api(`/api/tickets/${ticketId}`);
    log('GET /api/tickets/:id after process restart', afterRestart);
    assertStatus(afterRestart, 200, 'ticket after restart');
    const survived = (afterRestart.body as { ticket: { status: string; totalKurus: number; lines: unknown[] } }).ticket;
    if (survived.status !== 'open' || survived.totalKurus !== adana.priceKurus * 2 || survived.lines.length !== 1) {
      throw new Error('ticket did not survive process restart');
    }

    const kitchen = await api(`/api/tickets/${ticketId}/kitchen`, { method: 'POST' });
    log('POST /api/tickets/:id/kitchen', kitchen);
    assertStatus(kitchen, 200, 'kitchen');

    const closed = await api(`/api/tickets/${ticketId}/close`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'nakit' }),
    });
    log('POST /api/tickets/:id/close', closed);
    assertStatus(closed, 200, 'close');
    const closedTicket = (closed.body as { stub: boolean; ticket: { status: string; paymentMethod: string; totalKurus: number } });
    if (!closedTicket.stub || closedTicket.ticket.status !== 'closed' || closedTicket.ticket.paymentMethod !== 'nakit') {
      throw new Error('close did not record the payment method');
    }
    if (closedTicket.ticket.totalKurus !== adana.priceKurus * 2) {
      throw new Error('closed total changed');
    }

    const secondExit = await stopServer(child);
    log('API process restart — second stop exit code', { exitCode: secondExit });
    child = startServer();
    await waitForHealth(child);
    const afterCloseRestart = await api(`/api/tickets/${ticketId}`);
    log('GET /api/tickets/:id after close and second restart', afterCloseRestart);
    assertStatus(afterCloseRestart, 200, 'closed ticket after restart');
    const finalTicket = (afterCloseRestart.body as { ticket: { status: string; paymentMethod: string } }).ticket;
    if (finalTicket.status !== 'closed' || finalTicket.paymentMethod !== 'nakit') {
      throw new Error('closed ticket did not survive the second restart');
    }
  } finally {
    if (child.exitCode === null) {
      const exitCode = await stopServer(child);
      log('API process final stop exit code', { exitCode });
    }
  }

  const listing = fs.statSync(dbPath);
  log('sqlite file stat', {
    path: dbPath,
    size: listing.size,
    isFile: listing.isFile(),
  });

  const db = new DatabaseSync(dbPath);
  try {
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM venues) AS venues,
           (SELECT COUNT(*) FROM tables) AS tables,
           (SELECT COUNT(*) FROM products) AS products,
           (SELECT COUNT(*) FROM tickets) AS tickets,
           (SELECT COUNT(*) FROM ticket_lines) AS ticket_lines`,
      )
      .get();
    log('SQL COUNT(*) venues/tables/products/tickets/ticket_lines', counts);
    const plain = { ...(counts as Record<string, number>) };
    if (plain.venues !== 1 || plain.tables !== 12 || plain.products !== 15 || plain.tickets !== 1 || plain.ticket_lines !== 1) {
      throw new Error(`unexpected counts ${JSON.stringify(plain)}`);
    }
  } finally {
    db.close();
  }

  console.log('\nHAPPY_PATH_OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
