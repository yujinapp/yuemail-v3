/**
 * Server binding contract (acceptance #2).
 *
 * We assert the server module exports the host/port constants the spec
 * requires (127.0.0.1:5180), without actually opening a socket -- that
 * would race with other tests reusing the port.
 */
import { describe, it, expect } from 'vitest';

describe('server bind (acceptance #2)', () => {
  it('exports HOST = 127.0.0.1 (loopback only)', async () => {
    const mod = await import('../server/index.js');
    expect(mod.HOST).toBe('127.0.0.1');
  });

  it('exports PORT = 5180 (spec)', async () => {
    const mod = await import('../server/index.js');
    expect(mod.PORT).toBe(5180);
  });
});
