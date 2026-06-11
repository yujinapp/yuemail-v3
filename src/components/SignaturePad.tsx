/**
 * Signature pad modal (F4).
 *
 * User draws on a canvas with mouse / finger / stylus, or types a name
 * for cursive-rendered baking. Save persists PNG via /api/signature.
 *
 * ASCII-only.
 */
import * as React from 'react';

const W = 480;
const H = 160;

export interface SignaturePadProps {
  onCancel: () => void;
  onSave:   (pngBase64: string) => void;
}

export function SignaturePad({ onCancel, onSave }: SignaturePadProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const [typedName, setTypedName] = React.useState('');

  function getCtx(): CanvasRenderingContext2D | null {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext('2d');
  }

  React.useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0f1419';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = e.currentTarget.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = e.currentTarget.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }

  function onUp() {
    drawingRef.current = false;
    const ctx = getCtx();
    if (ctx) ctx.closePath();
  }

  function bakeTypedName() {
    const ctx = getCtx();
    if (!ctx || !typedName.trim()) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0f1419';
    ctx.font = 'italic 48px "Source Serif Pro", Georgia, serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName.trim(), 16, H / 2);
  }

  function clear() {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
  }

  function save() {
    const c = canvasRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const pngBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    onSave(pngBase64);
  }

  return (
    <div className="yuemail-modal" role="dialog" aria-label="Guardar firma" data-nac-id="yuemail.signature.modal" data-nac-role="dialog">
      <div className="yuemail-modal-card">
        <h2 style={{ marginTop: 0 }}>Guardar firma</h2>
        <p>Dibujá tu firma con el mouse, dedo o stylus -- o escribí tu nombre.</p>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ border: '1px solid var(--color-border-default)', borderRadius: 4, touchAction: 'none', background: '#ffffff' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          data-nac-id="yuemail.signature.canvas"
          data-nac-role="canvas"
          data-nac-action="draw_signature"
        />
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="O escribí tu nombre"
            data-nac-id="yuemail.signature.typed-name"
            data-nac-role="textbox"
            data-nac-action="type_signature_name"
            aria-label="Nombre para firma escrita"
          />
          <button type="button" onClick={bakeTypedName} disabled={!typedName.trim()} data-nac-id="yuemail.signature.btn-bake" data-nac-action="bake_signature_name">
            Generar firma cursiva
          </button>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={clear} data-nac-id="yuemail.signature.btn-clear" data-nac-action="clear_signature">Borrar</button>
          <button type="button" onClick={onCancel} data-nac-id="yuemail.signature.btn-cancel" data-nac-action="cancel_signature">Cancelar</button>
          <button type="button" onClick={save} data-nac-id="yuemail.signature.btn-save" data-nac-action="save_signature">Guardar</button>
        </div>
      </div>
    </div>
  );
}
