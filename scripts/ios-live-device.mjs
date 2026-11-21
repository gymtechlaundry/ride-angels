#!/usr/bin/env node
/**
 * Physical-device live reload.
 * Requires `npm run start:external` already serving on :4200.
 *
 * Optional: IOS_DEVICE_UDID=... to force a device.
 *
 * On Xcode 27+, `npx cap run ios --list` often omits physical devices
 * (native-run still looks for Simulator.app / Device Hub listing). We fall
 * back to `xcrun devicectl` so a plugged-in iPhone still auto-targets.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

function pickUniquePhysical(devices) {
  if (devices.length === 1) {
    console.log(`Using device: ${devices[0].name} (${devices[0].udid})`);
    return devices[0].udid;
  }
  if (devices.length > 1) {
    console.log('Multiple devices online — pick one with IOS_DEVICE_UDID=...');
    for (const d of devices) {
      console.log(`  ${d.name} → ${d.udid}`);
    }
  }
  return null;
}

/** Capacitor / native-run listing (often empty for physical devices on Xcode 27). */
function listFromCapacitor() {
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
  return physical;
}

/** Xcode 27 Device Hub / CoreDevice — reliable for a USB/network paired phone. */
function listFromDevicectl() {
  const dir = mkdtempSync(join(tmpdir(), 'ra-ios-devices-'));
  const out = join(dir, 'devices.json');
  try {
    const listed = spawnSync(
      'xcrun',
      [
        'devicectl',
        'list',
        'devices',
        '--filter',
        'properties.hardware.reality == "physical"',
        '--json-output',
        out,
      ],
      { encoding: 'utf8' },
    );
    if (listed.status !== 0) {
      return [];
    }
    const raw = JSON.parse(readFileSync(out, 'utf8'));
    const devices = raw?.result?.devices ?? [];
    const paired = [];
    for (const dev of devices) {
      const props = dev.properties ?? {};
      const hw = props.hardware ?? dev.hardwareProperties ?? {};
      const conn = props.connection ?? dev.connectionProperties ?? {};
      const deviceMeta = props.device ?? dev.deviceProperties ?? {};
      const udid = String(hw.udid ?? '').trim();
      if (!udid) continue;
      const pairing = String(
        conn.pairingState ??
          dev.connectionProperties?.pairingState ??
          '',
      ).toLowerCase();
      if (pairing && pairing !== 'paired') continue;

      const tunnel = String(
        conn.tunnelState ??
          conn.state ??
          dev.connectionProperties?.tunnelState ??
          '',
      ).toLowerCase();
      const ready =
        tunnel === 'connected' ||
        tunnel === 'available' ||
        !!conn.tunnelIPAddressString ||
        !!dev.connectionProperties?.tunnelIPAddressString;
      const name =
        deviceMeta.name ||
        hw.marketingName ||
        'iPhone';
      paired.push({ name, udid, ready });
    }
    // Prefer a tunnel-ready phone; otherwise still return paired ones
    // (unlock / wake the device if deploy then fails).
    const ready = paired.filter((d) => d.ready);
    return ready.length ? ready : paired;
  } catch {
    return [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Prefer an available paired iPhone/iPad. */
function resolvePhysicalDeviceTarget() {
  if (process.env.IOS_DEVICE_UDID?.trim()) {
    return process.env.IOS_DEVICE_UDID.trim();
  }

  const fromCap = listFromCapacitor();
  const pickedCap = pickUniquePhysical(fromCap);
  if (pickedCap) return pickedCap;

  const fromDevice = listFromDevicectl();
  if (fromDevice.length) {
    console.log(
      'Capacitor did not list a physical device; using xcrun devicectl.',
    );
  }
  return pickUniquePhysical(fromDevice);
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
    'No online physical device auto-detected.\n' +
      'Unlock/plug in the iPhone, trust this Mac, open Device Hub once, then retry.\n' +
      'Or force: IOS_DEVICE_UDID=00008140-0018781C0C91401C npm run ios:live:device',
  );
}

console.log(`Live reload → http://${host}:4200`);
const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
