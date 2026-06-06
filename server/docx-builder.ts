/**
 * Yuemail .docx generator (F5 / acceptance #7).
 *
 * Converts a document JSON (title + ordered blocks of paragraph or
 * signature image) into a real Office Open XML buffer using the
 * `docx` library. The buffer's first two bytes are always `PK`
 * (ZIP magic) because .docx is a ZIP container.
 *
 * Never persisted as a separate file -- rebuilt from JSON on demand.
 *
 * ASCII-only.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
} from 'docx';

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface SignatureImageBlock {
  type: 'signature_image';
  /** Base64-encoded PNG. */
  png_b64: string;
}

export type DocumentBlock = ParagraphBlock | SignatureImageBlock;

export interface YuemailDocument {
  id:     string;
  title:  string;
  blocks: DocumentBlock[];
  created_at: string;
  updated_at: string;
}

export async function renderDocx(doc: YuemailDocument): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: doc.title || 'Documento', bold: true })],
    }),
  );

  for (const block of doc.blocks) {
    if (block.type === 'paragraph') {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.text })],
        }),
      );
    } else if (block.type === 'signature_image') {
      const png = Buffer.from(block.png_b64, 'base64');
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: png,
              transformation: { width: 200, height: 80 },
            } as ConstructorParameters<typeof ImageRun>[0]),
          ],
        }),
      );
    }
  }

  const docxDoc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(docxDoc);
}

/** Sanity helper for tests + the /api/document/:id/docx endpoint. */
export function isDocxBuffer(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;  /* "PK" */
}
