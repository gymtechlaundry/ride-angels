#!/usr/bin/env node
/**
 * Physical-device live reload (Xcode 27+).
 *
 * Capacitor/`native-run` only lists simulators on Xcode 27, so `cap run ios
 * --target <phone-udid>` fails with "Invalid target ID". This script:
 *   1. Requires `npm run start:external` on :4200
 *   2. Patches ios/.../capacitor.config.json with server.url
 *   3. Builds with xcodebuild for the paired phone
 *   4. Installs + launches via `xcrun devicectl`
 *
 * Optional: IOS_DEVICE_UDID=... to force a device.
 * Ctrl+C restores capacitor.config.json.
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const iosAppDir = join(root, 'ios', 'App');
const capConfigPath = join(iosAppDir, 'App', 'capacitor.config.json');
const bundleId = 'org.rideangels.app';
const scheme = 'App';

function lanIPv4() {
  const preferred = spawnSync('ipconfig', ['getifaddr', 'en0'], {
    encoding: 'utf8',
  }).stdout?.trim();
  if (preferred) return preferred;
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: opts.stdio ?? 'pipe',
    cwd: opts.cwd,
  });
  if (result.status !== 0 && !opts.allowFail) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(
      `${cmd} ${args.join(' ')} failed (exit ${result.status})${err ? `\n${err}` : ''}`,
    );
  }
  return result;
}

function listPairedPhones() {
  const dir = mkdtempSync(join(tmpdir(), 'ra-ios-devices-'));
  const out = join(dir, 'devices.json');
  try {
    run('xcrun', [
      'devicectl',
      'list',
      'devices',
      '--filter',
      'properties.hardware.reality == "physical"',
      '--json-output',
      out,
    ]);
    const raw = JSON.parse(readFileSync(out, 'utf8'));
    const devices = raw?.result?.devices ?? [];
    const paired = [];
    for (const dev of devices) {
      const props = dev.properties ?? {};
      const hw = props.hardware ?? {};
      const conn = props.connection ?? {};
      const meta = props.device ?? dev.deviceProperties ?? {};
      const udid = String(hw.udid ?? '').trim();
      if (!udid) continue;
      const pairing = String(
        conn.pairingState ?? dev.connectionProperties?.pairingState ?? '',
      ).toLowerCase();
      if (pairing && pairing !== 'paired') continue;
      const state = String(
        conn.state ??
          conn.tunnelState ??
          dev.connectionProperties?.tunnelState ??
          '',
      ).toLowerCase();
      paired.push({
        name: meta.name || hw.marketingName || 'iPhone',
        udid,
        ready: state === 'connected' || state === 'available',
        state: state || 'unknown',
      });
    }
    const ready = paired.filter((d) => d.ready);
    return ready.length ? ready : paired;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function resolveDevice() {
  const forced = process.env.IOS_DEVICE_UDID?.trim();
  if (forced) return { name: 'iPhone', udid: forced, ready: true, state: 'forced' };

  const phones = listPairedPhones();
  if (phones.length === 1) {
    console.log(
      `Using device: ${phones[0].name} (${phones[0].udid}) [${phones[0].state}]`,
    );
    return phones[0];
  }
  if (phones.length > 1) {
    console.error('Multiple phones paired — set IOS_DEVICE_UDID=...');
    for (const p of phones) {
      console.error(`  ${p.name} → ${p.udid} (${p.state})`);
    }
    process.exit(1);
  }
  console.error(
    'No paired physical iPhone found.\n' +
      'Unlock the phone, plug in USB, trust this Mac, open Device Hub once, then retry.',
  );
  process.exit(1);
}

function patchLiveReloadConfig(host, port) {
  if (!existsSync(capConfigPath)) {
    throw new Error(`Missing ${capConfigPath} — run npx cap sync ios first.`);
  }
  const original = readFileSync(capConfigPath, 'utf8');
  const json = JSON.parse(original);
  json.server = {
    ...(json.server ?? {}),
    url: `http://${host}:${port}`,
    cleartext: true,
  };
  writeFileSync(capConfigPath, `${JSON.stringify(json, null, '\t')}\n`);
  return original;
}

function refreshDevice(udid) {
  const phones = listPairedPhones();
  return phones.find((p) => p.udid === udid) ?? null;
}

/** Wait until CoreDevice reports the phone online (USB or wireless). */
function waitForDeviceOnline(udid, timeoutMs = 90_000) {
  const started = Date.now();
  let lastState = 'unknown';
  console.log(
    'Waiting for iPhone to come online (USB data cable or wireless debugging)…',
  );
  while (Date.now() - started < timeoutMs) {
    const current = refreshDevice(udid);
    lastState = current?.state ?? 'missing';
    if (current?.ready) {
      console.log(`Device online: ${current.name} (${udid})`);
      return current;
    }
    spawnSync('sleep', ['2']);
  }
  throw new Error(
    `iPhone still ${lastState} after ${Math.round(timeoutMs / 1000)}s.\n` +
      'Xcode cannot see it — unlock alone is not enough.\n' +
      'Fix connection, then retry:\n' +
      '  1. Use a USB data cable (not charge-only); unplug/replug\n' +
      '  2. Trust This Computer on the phone\n' +
      '  3. Open Device Hub and confirm the phone is Connected\n' +
      '  4. Or enable wireless debugging while on the same Wi‑Fi\n' +
      'Check: xcrun xctrace list devices   (must NOT say Devices Offline)',
  );
}

function buildForDevice(udid) {
  // Build for generic iOS device — does not require the phone to be online.
  // Install still needs a live CoreDevice connection afterward.
  const derivedDataPath = join(root, 'ios', 'DerivedData', udid);
  const project = 'App.xcodeproj';
  console.log('Running xcodebuild (generic iOS device)…');
  run(
    'xcrun',
    [
      'xcodebuild',
      '-project',
      project,
      '-scheme',
      scheme,
      '-configuration',
      'Debug',
      '-destination',
      'generic/platform=iOS',
      '-derivedDataPath',
      derivedDataPath,
      '-allowProvisioningUpdates',
    ],
    { cwd: iosAppDir, stdio: 'inherit' },
  );
  const appPath = join(
    derivedDataPath,
    'Build',
    'Products',
    'Debug-iphoneos',
    `${scheme}.app`,
  );
  if (!existsSync(appPath)) {
    throw new Error(`Build succeeded but App.app not found at ${appPath}`);
  }
  return appPath;
}

function installAndLaunch(udid, appPath) {
  console.log('Installing on device…');
  run(
    'xcrun',
    ['devicectl', 'device', 'install', 'app', '--device', udid, appPath],
    { stdio: 'inherit' },
  );
  console.log('Launching…');
  run(
    'xcrun',
    [
      'devicectl',
      'device',
      'process',
      'launch',
      '--device',
      udid,
      bundleId,
    ],
    { stdio: 'inherit' },
  );
}

const host = lanIPv4();
if (!host) {
  console.error(
    'Could not resolve a LAN IP (en0). Connect Wi‑Fi, then retry.',
  );
  process.exit(1);
}

const port = 4200;
const probe = run(
  'curl',
  ['-sS', '-m', '2', '-o', '/dev/null', '-w', '%{http_code}', `http://${host}:${port}/`],
  { allowFail: true },
);
const code = (probe.stdout || '').trim();
if (!['200', '304'].includes(code)) {
  console.error(
    `Angular is not reachable at http://${host}:${port} (HTTP ${code || 'down'}).\n` +
      'In another terminal run:\n' +
      '  npm run start:external\n' +
      'Wait until it says Local/Network, then retry npm run ios:live:device',
  );
  process.exit(1);
}

const device = resolveDevice();

let originalConfig = null;
const restore = () => {
  if (originalConfig != null) {
    writeFileSync(capConfigPath, originalConfig);
    originalConfig = null;
    console.log('Restored capacitor.config.json (live-reload URL removed).');
  }
};

process.on('SIGINT', () => {
  restore();
  process.exit(0);
});
process.on('SIGTERM', () => {
  restore();
  process.exit(0);
});

try {
  originalConfig = patchLiveReloadConfig(host, port);
  console.log(`Live reload → http://${host}:${port}`);
  const appPath = buildForDevice(device.udid);
  const online = device.ready
    ? device
    : waitForDeviceOnline(device.udid);
  installAndLaunch(online.udid, appPath);
  console.log(
    '\nApp launched with live reload. Keep this terminal open.\n' +
      'Edit/save Angular → phone updates. Ctrl+C when done.',
  );
  // Stay alive so Ctrl+C can restore config; ng serve is the actual reload engine.
  setInterval(() => {}, 1 << 30);
} catch (err) {
  restore();
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
