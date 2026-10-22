import { readFile, writeFile, rename } from 'node:fs/promises';
export const heartbeatPath = '/tmp/industryconnect-worker-heartbeat.json';
export function heartbeatFresh(value: unknown, now = Date.now()) {
  if (!value || typeof value !== 'object' || !('lastSuccess' in value)) return false;
  const timestamp = (value as { lastSuccess: unknown }).lastSuccess;
  return (
    typeof timestamp === 'number' &&
    Number.isFinite(timestamp) &&
    timestamp <= now &&
    now - timestamp < 600000
  );
}
export async function writeHeartbeat() {
  await writeFile(heartbeatPath + '.tmp', JSON.stringify({ lastSuccess: Date.now() }), {
    mode: 0o600,
  });
  await rename(heartbeatPath + '.tmp', heartbeatPath);
}
export async function readHeartbeat() {
  try {
    return heartbeatFresh(JSON.parse(await readFile(heartbeatPath, 'utf8')));
  } catch {
    return false;
  }
}
