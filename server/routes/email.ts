/**
 * /api/email/send route (F6 / acceptance #4 + PND-024).
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
 * credentials are missing (acceptance #4). User-facing error strings are
 * in Spanish (the product language) and actionable -- they tell the user
 * what to fix, not just what failed. Shape:
 *   { ok: false, error: '<mensaje en castellano>', missing: [...] }
 *
 * On send success returns:
 *   { ok: true, message_id, accepted, rejected }
 *
 * Also auto-registers recipients for future completion (PND-024).
 *
 * ASCII-only.
 */
import type { Express, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { getCategoryStatus, getKey } from '../vault.js';
import { getDocument } from '../documents.js';
import { renderDocx } from '../docx-builder.js';
import { upsertRecipientsFromSend } from '../contacts.js';

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
        error: 'El correo saliente todavia no esta configurado. Abri Configuracion y carga tu servidor de envio (SMTP) antes de mandar.',
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
          ? 'No hay ningun destinatario valido. Revisa estas direcciones mal escritas: ' + badTo.join(', ') + '.'
          : 'Falta el destinatario. Escribi al menos una direccion de correo.',
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
      res.status(400).json({ ok: false, error: 'Falta una credencial del correo saliente (SMTP). Volve a guardar la configuracion de tu cuenta.' });
      return;
    }
    const port = Number(portStr);
    if (!Number.isFinite(port) || port <= 0) {
      res.status(400).json({ ok: false, error: 'El puerto del correo saliente (SMTP) no es valido. Corregilo en Configuracion (por ejemplo 587 o 465).' });
      return;
    }
    const secure = (secStr ?? '').toLowerCase() === 'true' || port === 465;

    /* 4. Render attachment (when requested). */
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    if (attachId.length > 0) {
      const doc = await getDocument(attachId);
      if (!doc) {
        res.status(404).json({ ok: false, error: 'No se encontro el documento que querias adjuntar.' });
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
      /* Auto-register recipients in the address book (PND-024).
       * Best-effort: do not break the response if this fails. */
      try {
        await upsertRecipientsFromSend(validTo);
      } catch {
        /* never break the send response */
      }
      res.json({
        ok:         true,
        message_id: info.messageId,
        accepted:   info.accepted,
        rejected:   info.rejected,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: 'No se pudo enviar el correo: ' + message });
    }
  });
}
