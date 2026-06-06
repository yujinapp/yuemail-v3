/**
 * CLI help + version surface (F12 / acceptance #3 reachability).
 *
 * We assert the text content of `bin/yuemail.mjs` exposes the documented
 * subcommands so the spec (F12) and the help screen stay in sync. The
 * exec-level happy-path is covered by manual smoke + the post-publish
 * `yuemail vault setup` walkthrough.
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const CLI_PATH = path.resolve('bin', 'yuemail.mjs');

describe('CLI surface (F12)', () => {
  it('the bin file exists + starts with a node shebang', async () => {
    const src = await fs.readFile(CLI_PATH, 'utf-8');
    expect(src.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('declares the 7 documented subcommands somewhere in the source', async () => {
    const src = await fs.readFile(CLI_PATH, 'utf-8');
    for (const sub of ['start', 'vault list', 'vault set', 'vault delete', 'vault setup', 'version', 'help']) {
      expect(src).toContain(sub);
    }
  });

  it('describes the 12 vault keys in the help string', async () => {
    const src = await fs.readFile(CLI_PATH, 'utf-8');
    const requiredKeys = [
      'imap.host', 'imap.port', 'imap.user', 'imap.pass', 'imap.secure',
      'smtp.host', 'smtp.port', 'smtp.user', 'smtp.pass', 'smtp.secure',
      'identity.from', 'identity.name',
    ];
    for (const k of requiredKeys) {
      expect(src).toContain(k);
    }
  });

  it('binds 127.0.0.1 (loopback) -- never LAN', async () => {
    const src = await fs.readFile(CLI_PATH, 'utf-8');
    expect(src).toContain('127.0.0.1');
    expect(src).not.toContain('0.0.0.0');
  });
});
