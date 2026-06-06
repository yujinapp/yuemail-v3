/**
 * Yuemail signature store (F4).
 *
 * Single saved signature PNG at ~/.yuemail/signatures/default.png.
 * The frontend POSTs a base64 PNG; we decode and write. GET returns
 * the bytes; HEAD returns 200 / 404 for existence checks.
 *
 * ASCII-only.
 */
import { promises as fs, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function homeDir(): string {
  const env = process.env['YUEMAIL_HOME'];
  return env ? path.resolve(env) : path.join(os.homedir(), '.yuemail');
}
function sigDir():  string { return path.join(homeDir(), 'signatures'); }
function sigFile(): string { return path.join(sigDir(), 'default.png'); }

function ensureSigDir(): void {
  const d = sigDir();
  if (!existsSync(d)) {
    mkdirSync(d, { recursive: true, mode: 0o700 });
  }
}

export function signaturePath(): string {
  return sigFile();
}

export function hasSignature(): boolean {
  return existsSync(sigFile());
}

export async function saveSignature(pngBase64: string): Promise<void> {
  ensureSigDir();
  const png = Buffer.from(pngBase64, 'base64');
  if (png.length < 8) {
    throw new Error('signature PNG too small');
  }
  /* PNG magic: 89 50 4E 47 0D 0A 1A 0A. */
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
    throw new Error('not a PNG');
  }
  await fs.writeFile(sigFile(), png, { mode: 0o600 });
}

export async function readSignaturePngBase64(): Promise<string | undefined> {
  if (!existsSync(sigFile())) return undefined;
  const buf = await fs.readFile(sigFile());
  return buf.toString('base64');
}

export async function deleteSignature(): Promise<boolean> {
  if (!existsSync(sigFile())) return false;
  await fs.unlink(sigFile());
  return true;
}
