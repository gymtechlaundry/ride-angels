#!/usr/bin/env node
/**
 * Physical-device live reload.
 * Requires `npm run start:external` already serving on :4200.
 *
 * Optional: IOS_DEVICE_UDID=... to force a device.
 */
import { spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';

function lanIPv4() {
  const preferred = spawnSync('ipconfig', ['getifaddr', 'en0'], {
    encoding: 'utf8',
  }).stdout?.trim();
  if (preferred) {
    return preferred;
  }
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

/** Prefer an available paired iPhone/iPad visible to Capacitor (`cap run ios --list`). */
function resolvePhysicalDeviceTarget() {
  if (process.env.IOS_DEVICE_UDID?.trim()) {
    return process.env.IOS_DEVICE_UDID.trim();
  }

  const listed = spawnSync('npx', ['cap', 'run', 'ios', '--list'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const text = `${listed.stdout || ''}\n${listed.stderr || ''}`;
  const physical = [];
  for (const line of text.split('\n')) {
    if (!/\(simulator\)/i.test(line) && /iPhone|iPad/i.test(line)) {
      const parts = line.trim().split(/\s{2,}/);
      const id = parts[parts.length - 1];
      if (/^[0-9A-Fa-f-]{20,}$/.test(id)) {
        physical.push({ name: parts[0], udid: id });
      }
    }
  }

  if (physical.length === 1) {
    console.log(`Using device: ${physical[0].name} (${physical[0].udid})`);
    return physical[0].udid;
  }
  if (physical.length > 1) {
    console.log('Multiple devices online — pick one with IOS_DEVICE_UDID=...');
    for (const d of physical) {
      console.log(`  ${d.name} → ${d.udid}`);
    }
  }
  return null;
}

const host = lanIPv4();
if (!host) {
  console.error(
    'Could not resolve a LAN IP (en0). Connect Wi‑Fi, then retry.\n' +
      'Or run: npx cap run ios -l --host=YOUR_MAC_IP --port=4200',
  );
  process.exit(1);
}

const probe = spawnSync(
  'curl',
  [
    '-sS',
    '-m',
    '2',
    '-o',
    '/dev/null',
    '-w',
    '%{http_code}',
    `http://${host}:4200/`,
  ],
  { encoding: 'utf8' },
);
const code = (probe.stdout || '').trim();
if (!['200', '304'].includes(code)) {
  console.error(
    `Angular is not reachable at http://${host}:4200 (HTTP ${code || 'down'}).\n` +
      'In another terminal run:\n' +
      '  npm run start:external\n' +
      'Wait until it says Local/Network, then retry npm run ios:live:device',
  );
  process.exit(1);
}

const target = resolvePhysicalDeviceTarget();
const args = ['cap', 'run', 'ios', '-l', `--host=${host}`, '--port=4200'];
if (target) {
  args.push(`--target=${target}`);
} else {
  console.warn(
    'No online physical device auto-detected. Capacitor will prompt (needs a real terminal).\n' +
      'Unlock/plug in the iPhone, trust this Mac, then retry — or set IOS_DEVICE_UDID.',
  );
}

console.log(`Live reload → http://${host}:4200`);
const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
