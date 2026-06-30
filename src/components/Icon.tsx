/**
 * Icon -- sumi-e (ink-on-washi) glyphs from the Yujin Design System.
 *
 * Each glyph is a brush-stroke SVG drawn on a 0..40 canvas. Strokes inherit
 * the button's text color via `currentColor` (see `.yj-sumie` in app.css), so
 * an icon tints itself to whatever control it sits in. Shapes meant to read as
 * solid ink (a bullseye center, the brain's synapse dots) carry `ink-fill`.
 *
 * Icons are DECORATIVE: aria-hidden="true". The button's aria-label / visible
 * text still carries the meaning for screen readers and voice. Never rely on
 * an icon alone to convey an action.
 *
 * ASCII-only.
 */
import * as React from 'react';

export type IconName =
  | 'brain-cells'
  | 'speech-cloud'
  | 'target-bullseye'
  | 'people-pair'
  | 'gear-cog'
  | 'mic-voice'
  | 'pencil-write'
  | 'folder-tab'
  | 'signature-loop'
  | 'seal-stamp'
  | 'paper-plane'
  | 'envelope-letter';

const GLYPHS: Record<IconName, React.ReactNode> = {
  'brain-cells': (
    <>
      <path d="M14 8 Q8 8 8 14 Q4 18 8 22 Q4 28 12 30 Q14 34 20 32 Q26 34 28 30 Q36 28 32 22 Q36 18 32 14 Q32 8 26 8 Q22 4 20 8 Q18 4 14 8 z" />
      <circle cx="14" cy="18" r="1" className="ink-fill" />
      <circle cx="26" cy="18" r="1" className="ink-fill" />
      <circle cx="20" cy="24" r="1" className="ink-fill" />
    </>
  ),
  'speech-cloud': (
    <path d="M6 12 L34 12 Q36 12 36 14 L36 26 Q36 28 34 28 L18 28 L10 34 L12 28 L6 28 Q4 28 4 26 L4 14 Q4 12 6 12 z" />
  ),
  'target-bullseye': (
    <>
      <circle cx="20" cy="20" r="14" />
      <circle cx="20" cy="20" r="9" />
      <circle cx="20" cy="20" r="4" className="ink-fill" />
    </>
  ),
  'people-pair': (
    <>
      <circle cx="14" cy="12" r="4" />
      <circle cx="26" cy="12" r="4" />
      <path d="M6 30 Q6 22 14 22 Q22 22 22 30" />
      <path d="M18 30 Q18 22 26 22 Q34 22 34 30" />
    </>
  ),
  'gear-cog': (
    <>
      <path d="M20 4 L22 8 L26 6 L26 10 L30 10 L28 14 L32 16 L28 18 L30 22 L26 22 L26 26 L22 24 L20 28 L18 24 L14 26 L14 22 L10 22 L12 18 L8 16 L12 14 L10 10 L14 10 L14 6 L18 8 z" />
      <circle cx="20" cy="16" r="3" />
    </>
  ),
  'mic-voice': (
    <>
      <path d="M16 6 L24 6 Q28 6 28 10 L28 20 Q28 24 24 24 L16 24 Q12 24 12 20 L12 10 Q12 6 16 6 z" />
      <path d="M8 22 Q8 30 20 30 Q32 30 32 22" />
      <path d="M20 30 L20 36" />
    </>
  ),
  'pencil-write': (
    <>
      <path d="M28 4 L36 12 L14 34 L4 36 L6 26 z" />
      <path d="M24 8 L32 16" />
    </>
  ),
  'folder-tab': (
    <>
      <path d="M4 12 L14 12 L18 8 L36 8 L36 32 L4 32 z" />
      <path d="M4 16 L36 16" />
    </>
  ),
  'signature-loop': (
    <>
      <path d="M4 30 L34 30" />
      <path d="M6 22 Q14 8 18 22 Q22 36 26 18 Q30 8 34 22" />
    </>
  ),
  'seal-stamp': (
    <>
      <path d="M16 6 L24 6 L24 22 L16 22 z" />
      <path d="M14 22 L26 22 L26 28 L14 28 z" />
      <path d="M12 30 L28 30 L28 34 L12 34 z" />
    </>
  ),
  'paper-plane': (
    <>
      <path d="M4 20 L36 4 L26 36 L20 22 z" />
      <path d="M20 22 L36 4" />
    </>
  ),
  'envelope-letter': (
    <>
      <path d="M6 10 L34 10 L34 30 L6 30 z" />
      <path d="M6 10 L20 22 L34 10" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
}

export function Icon({ name }: IconProps): React.ReactElement {
  return (
    <svg className="yj-sumie" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      {GLYPHS[name]}
    </svg>
  );
}
