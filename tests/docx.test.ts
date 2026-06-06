import { describe, it, expect } from 'vitest';
import { renderDocx, isDocxBuffer } from '../server/docx-builder.js';

describe('renderDocx (F5 / acceptance #7)', () => {
  it('produces a buffer whose first two bytes are PK (ZIP magic)', async () => {
    const buf = await renderDocx({
      id: 'doc-test',
      title: 'Mi documento',
      blocks: [
        { type: 'paragraph', text: 'Hola, esto es un parrafo.' },
      ],
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
    expect(buf.length).toBeGreaterThan(2);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(isDocxBuffer(buf)).toBe(true);
  });

  it('renders an empty-body document (title only) without throwing', async () => {
    const buf = await renderDocx({
      id: 'doc-empty',
      title: 'Solo titulo',
      blocks: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
    expect(isDocxBuffer(buf)).toBe(true);
  });

  it('isDocxBuffer rejects plain text', () => {
    expect(isDocxBuffer(Buffer.from('hello world', 'utf-8'))).toBe(false);
  });

  it('isDocxBuffer rejects buffers shorter than 2 bytes', () => {
    expect(isDocxBuffer(Buffer.from([0x50]))).toBe(false);
  });

  it('renders multiple paragraph blocks', async () => {
    const buf = await renderDocx({
      id: 'doc-multi',
      title: 'Multiples',
      blocks: [
        { type: 'paragraph', text: 'Primer parrafo.' },
        { type: 'paragraph', text: 'Segundo parrafo.' },
        { type: 'paragraph', text: 'Tercer parrafo.' },
      ],
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
    expect(isDocxBuffer(buf)).toBe(true);
    /* Multiple paragraphs should grow the file. */
    expect(buf.length).toBeGreaterThan(500);
  });
});
