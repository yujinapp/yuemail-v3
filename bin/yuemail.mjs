#!/usr/bin/env node
/**
 * yuemail CLI (F12).
 *
 * Subcommands:
 *   yuemail                       launch server + open browser
 *   yuemail start                 server only (no browser)
 *   yuemail vault list            list configured key names
 *   yuemail vault set <name> <v>  set a key
 *   yuemail vault delete <name>   delete a key
 *   yuemail vault setup           interactive 12-field wizard
 *   yuemail version
 *   yuemail help
 *
 * Server binds 127.0.0.1 only. Loopback. Never LAN.
 *
 * ASCII-only.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const VERSION = '0.3.0';

function printHelp() {
  process.stdout.write(
    'yuemail v' + VERSION + '\n' +
    'Voice-first single-user email client.\n\n' +
    'Usage: yuemail [command]\n\n' +
    'Commands:\n' +
    '  (no args)                  Start the server + open the browser.\n' +
    '  start                      Start the server only.\n' +
    '  vault list                 List configured vault key names.\n' +
    '  vault set <name> <value>   Encrypt and store a value.\n' +
    '  vault delete <name>        Remove a value.\n' +
    '  vault setup                Interactive 12-field wizard.\n' +
    '  version                    Print the version.\n' +
    '  help                       Show this message.\n' +
    '\n' +
    'Vault keys:\n' +
    '  imap.host, imap.port, imap.user, imap.pass, imap.secure\n' +
    '  smtp.host, smtp.port, smtp.user, smtp.pass, smtp.secure\n' +
    '  identity.from, identity.name\n' +
    '\n' +
    'The server binds 127.0.0.1:5180. Loopback only. Never LAN.\n',
  );
}

function resolveServerModule() {
  /* Prefer the built JS, fall back to ts-node for dev runs. */
  const builtPath = path.resolve(__dirname, '..', 'server-dist', 'index.js');
  try {
    return import('file://' + builtPath.replace(/\\/g, '/'));
  } catch (err) {
    process.stderr.write('Failed to load built server at ' + builtPath + '\n');
    process.stderr.write('Did you run `npm run build`?\n');
    throw err;
  }
}

function resolveVaultModule() {
  const builtPath = path.resolve(__dirname, '..', 'server-dist', 'vault.js');
  return import('file://' + builtPath.replace(/\\/g, '/'));
}

async function cmdStart({ openBrowser }) {
  const server = await (await resolveServerModule()).startServer();
  process.stdout.write('Yuemail listening at ' + server.url + '\n');
  if (openBrowser) {
    try {
      const { default: open } = await import('open');
      await open(server.url);
    } catch {
      process.stdout.write('(Could not open browser automatically. Visit ' + server.url + ' manually.)\n');
    }
  }
  /* Keep alive on SIGINT. */
  const shutdown = async () => {
    process.stdout.write('\nShutting down...\n');
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function cmdVaultList() {
  const { getAllKeys } = await resolveVaultModule();
  const keys = await getAllKeys();
  if (keys.length === 0) {
    process.stdout.write('(vault is empty -- run `yuemail vault setup`)\n');
    return;
  }
  for (const k of keys) process.stdout.write(k + '\n');
}

async function cmdVaultSet(name, value) {
  const { setKey, isValidVaultKey } = await resolveVaultModule();
  if (!isValidVaultKey(name)) {
    process.stderr.write('Unknown vault key: ' + name + '\n');
    process.stderr.write('Run `yuemail help` for the list of valid keys.\n');
    process.exitCode = 2;
    return;
  }
  await setKey(name, value);
  process.stdout.write('OK: ' + name + ' set.\n');
}

async function cmdVaultDelete(name) {
  const { deleteKey, isValidVaultKey } = await resolveVaultModule();
  if (!isValidVaultKey(name)) {
    process.stderr.write('Unknown vault key: ' + name + '\n');
    process.exitCode = 2;
    return;
  }
  const ok = await deleteKey(name);
  if (ok) process.stdout.write('OK: ' + name + ' removed.\n');
  else    process.stdout.write('Not present: ' + name + '\n');
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, (a) => resolve(a)));
}

async function cmdVaultSetup() {
  const { setKey, VAULT_KEYS } = await resolveVaultModule();
  process.stdout.write('Yuemail vault setup -- 12 fields. Press Enter to skip a field.\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let set = 0;
  for (const key of VAULT_KEYS) {
    const value = (await ask(rl, '  ' + key + ': ')).trim();
    if (value.length > 0) {
      await setKey(key, value);
      set++;
    }
  }
  rl.close();
  process.stdout.write('\n' + set + ' / 12 fields configured.\n');
}

async function main() {
  const args = process.argv.slice(2);
  const cmd  = args[0] ?? '';

  if (cmd === '' )                            return cmdStart({ openBrowser: true });
  if (cmd === 'start')                        return cmdStart({ openBrowser: false });
  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    process.stdout.write(VERSION + '\n');
    return;
  }
  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }
  if (cmd === 'vault') {
    const sub = args[1] ?? '';
    if (sub === 'list')   return cmdVaultList();
    if (sub === 'set')    return cmdVaultSet(args[2] ?? '', args[3] ?? '');
    if (sub === 'delete') return cmdVaultDelete(args[2] ?? '');
    if (sub === 'setup')  return cmdVaultSetup();
    process.stderr.write('Unknown vault subcommand: ' + sub + '\n');
    printHelp();
    process.exitCode = 2;
    return;
  }
  process.stderr.write('Unknown command: ' + cmd + '\n');
  printHelp();
  process.exitCode = 2;
}

main().catch((err) => {
  process.stderr.write('Error: ' + (err instanceof Error ? err.message : String(err)) + '\n');
  process.exitCode = 1;
});
