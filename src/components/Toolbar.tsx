/**
 * Toolbar (F1 / acceptance #6).
 *
 * Renders the four named buttons that must be visible at all times.
 * Each button is keyboard-focusable + screen-reader announced via the
 * label + NAC3 data attributes.
 *
 * ASCII-only.
 */
import * as React from 'react';
import { Icon, type IconName } from './Icon.js';

export const TOOLBAR_BUTTON_LABELS = [
  'Nuevo documento',
  'Abrir documento',
  'Guardar firma',
  'Firmar',
] as const;

export type ToolbarAction =
  | 'new_document'
  | 'open_document'
  | 'save_signature'
  | 'sign_document';

const BUTTONS: ReadonlyArray<{ label: string; action: ToolbarAction; nacElement: string; icon: IconName }> = [
  { label: 'Nuevo documento', action: 'new_document',    nacElement: 'btn-new-document',   icon: 'pencil-write' },
  { label: 'Abrir documento', action: 'open_document',   nacElement: 'btn-open-document',  icon: 'folder-tab' },
  { label: 'Guardar firma',   action: 'save_signature',  nacElement: 'btn-save-signature', icon: 'signature-loop' },
  { label: 'Firmar',          action: 'sign_document',   nacElement: 'btn-sign',           icon: 'seal-stamp' },
];

export interface ToolbarProps {
  onAction: (action: ToolbarAction) => void;
}

export function Toolbar({ onAction }: ToolbarProps): React.ReactElement {
  return (
    <nav
      className="yuemail-toolbar"
      role="toolbar"
      aria-label="Acciones de documento"
      data-nac-id="yuemail.toolbar.root"
      data-nac-role="toolbar"
    >
      {BUTTONS.map((b) => (
        <button
          key={b.action}
          type="button"
          onClick={() => onAction(b.action)}
          data-nac-id={'yuemail.toolbar.' + b.nacElement}
          data-nac-role="button"
          data-nac-action={b.action}
        >
          <Icon name={b.icon} />
          {b.label}
        </button>
      ))}
    </nav>
  );
}
