/**
 * Document editor (F3).
 *
 * Title input + textarea of paragraph blocks (one block per non-empty
 * line). Signature blocks render inline when present.
 *
 * The editor is controlled -- parent owns the document state.
 *
 * ASCII-only.
 */
import * as React from 'react';

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface SignatureImageBlock {
  type: 'signature_image';
  png_b64: string;
}

export type DocumentBlock = ParagraphBlock | SignatureImageBlock;

export interface EditorProps {
  title:   string;
  blocks:  DocumentBlock[];
  onTitleChange:  (next: string) => void;
  onBlocksChange: (next: DocumentBlock[]) => void;
}

function blocksToText(blocks: DocumentBlock[]): string {
  return blocks
    .filter((b): b is ParagraphBlock => b.type === 'paragraph')
    .map((b) => b.text)
    .join('\n');
}

function textToBlocks(text: string, signatures: SignatureImageBlock[]): DocumentBlock[] {
  const paragraphs = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line): ParagraphBlock => ({ type: 'paragraph', text: line }));
  return [...paragraphs, ...signatures];
}

export function Editor(props: EditorProps): React.ReactElement {
  const signatures = props.blocks.filter((b): b is SignatureImageBlock => b.type === 'signature_image');

  return (
    <section
      className="yuemail-editor"
      data-nac-id="yuemail.doc.editor"
      data-nac-role="region"
    >
      <input
        type="text"
        value={props.title}
        placeholder="Titulo del documento"
        onChange={(e) => props.onTitleChange(e.target.value)}
        data-nac-id="yuemail.doc.title"
        data-nac-role="textbox"
        data-nac-action="edit_title"
        aria-label="Titulo del documento"
      />
      <textarea
        value={blocksToText(props.blocks)}
        onChange={(e) => props.onBlocksChange(textToBlocks(e.target.value, signatures))}
        placeholder="Empezar a escribir o dictar"
        data-nac-id="yuemail.doc.body"
        data-nac-role="textbox"
        data-nac-action="edit_body"
        aria-label="Cuerpo del documento"
      />
      {signatures.length > 0 && (
        <div>
          {signatures.map((s, idx) => (
            <img
              key={'sig-' + idx}
              src={'data:image/png;base64,' + s.png_b64}
              alt="Firma"
              style={{ display: 'block', maxWidth: 240, marginTop: 12 }}
              data-nac-id={'yuemail.doc.signature-' + idx}
              data-nac-role="img"
            />
          ))}
        </div>
      )}
    </section>
  );
}
