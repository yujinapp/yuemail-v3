/**
 * /api/email/send route (F6 / acceptance #4).
 *
 * POST body:
 *   {
 *     to:        string,        // comma-separated recipients
 *     subject:   string,
 *     body_text: string,
 *     attach_document_id?: string,  // when present, render its .docx
 *   }
 *
 * Rejects with HTTP 400 and a meaningful error message when SMTP
 * credentials are missing (acceptance #4). Specifically: returns
 *   { ok: false, error: 'SMTP not configured', missing: [...] }
 *
 * On send success returns:
 *   { ok: true, message_id, accepted, rejected }
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { getCategoryStatus, getKey } from '../vault.js';
import { getDocument } from '../documents.js';
import { renderDocx } from '../docx-builder.js';

function isValidEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

function parseRecipients(raw: string): { ok: string[]; bad: string[] } {
  const tokens = raw.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  const ok: string[] = [];
  const bad: string[] = [];
  for (const t of tokens) {
    if (isValidEmail(t)) ok.push(t.toLowerCase());
    else bad.push(t);
  }
  return { ok, bad };
}

export function registerEmailRoutes(app: Express): void {
  app.post('/api/email/send', async (req: Request, res: Response) => {
    /* 1. Gate on SMTP configuration (acceptance #4). */
    const status = await getCategoryStatus();
    if (!status.smtp.configured) {
      res.status(400).json({
        ok: false,
        error: 'SMTP not configured. Run `yuemail vault setup` to configure your SMTP server before sending.',
        missing: status.smtp.missing,
      });
      return;
    }

    /* 2. Validate body. */
    const body = req.body as {
      to?:        unknown;
      subject?:   unknown;
      body_text?: unknown;
      attach_document_id?: unknown;
    } | undefined;
    const to        = typeof body?.to        === 'string' ? body.to        : '';
    const subject   = typeof body?.subject   === 'string' ? body.subject   : '';
    const bodyText  = typeof body?.body_text === 'string' ? body.body_text : '';
    const attachId  = typeof body?.attach_document_id === 'string' ? body.attach_document_id : '';

    const { ok: validTo, bad: badTo } = parseRecipients(to);
    if (validTo.length === 0) {
      res.status(400).json({
        ok: false,
        error: badTo.length > 0
          ? 'No valid recipients. Invalid entries: ' + badTo.join(', ')
          : 'No recipients provided.',
      });
      return;
    }

    /* 3. Build transport from vault. */
    const host    = await getKey('smtp.host');
    const portStr = await getKey('smtp.port');
    const user    = await getKey('smtp.user');
    const pass    = await getKey('smtp.pass');
    const secStr  = await getKey('smtp.secure');
    const from    = await getKey('identity.from');
    const name    = await getKey('identity.name');

    if (!host || !portStr || !user || !pass || !from) {
      res.status(400).json({ ok: false, error: 'SMTP not configured (missing decrypted credential)' });
      return;
    }
    const port = Number(portStr);
    if (!Number.isFinite(port) || port <= 0) {
      res.status(400).json({ ok: false, error: 'smtp.port is not a positive integer' });
      return;
    }
    const secure = (secStr ?? '').toLowerCase() === 'true' || port === 465;

    /* 4. Render attachment (when requested). */
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    if (attachId.length > 0) {
      const doc = await getDocument(attachId);
      if (!doc) {
        res.status(404).json({ ok: false, error: 'attach_document_id not found' });
        return;
      }
      const buf = await renderDocx(doc);
      attachments.push({
        filename: (doc.title || 'documento') + '.docx',
        content:  buf,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }

    /* 5. Send. */
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      const fromHeader = name && name.length > 0 ? '"' + name + '" <' + from + '>' : from;
      const info = await transporter.sendMail({
        from:    fromHeader,
        to:      validTo.join(', '),
        subject: subject.length > 0 ? subject : '(sin asunto)',
        text:    bodyText.length > 0 ? bodyText : 'Adjunto el documento.',
        attachments,
      });
      res.json({
        ok:         true,
        message_id: info.messageId,
        accepted:   info.accepted,
        rejected:   info.rejected,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: 'SMTP send failed: ' + message });
    }
  });
}
