/**
 * Contacts dialog (v0.6.4 / PND-022).
 *
 * Text-first by design: an assistant loads the address book by typing
 * (name + email + optional aliases) so the person who depends on voice can
 * later just say "enviar a <nombre>". Voice management of contacts is out
 * of scope on purpose -- the disabled user SENDS by voice; a helper SETS UP
 * the list by keyboard.
 *
 * ASCII-only.
 */
import * as React from 'react';
import type { Contact } from '../lib/contactMatch.js';

export interface ContactsDialogProps {
  contacts: Contact[];
  onAdd:    (input: { name: string; email: string; aliases: string[] }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onClose:  () => void;
}

export function ContactsDialog(props: ContactsDialogProps): React.ReactElement {
  const [name, setName]       = React.useState('');
  const [email, setEmail]     = React.useState('');
  const [aliases, setAliases] = React.useState('');

  function add() {
    const parsedAliases = aliases.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
    void Promise.resolve(props.onAdd({ name: name.trim(), email: email.trim(), aliases: parsedAliases }))
      .then(() => { setName(''); setEmail(''); setAliases(''); });
  }

  return (
    <div className="yuemail-modal" role="dialog" aria-label="Contactos" data-nac-id="yuemail.contacts.dialog" data-nac-role="dialog">
      <div className="yuemail-modal-card">
        <h2 style={{ marginTop: 0 }}>Contactos</h2>
        <p style={{ fontSize: 13, opacity: 0.7 }} role="note" data-nac-id="yuemail.contacts.hint">
          Carga aca las personas a las que se les escribe. Despues, por voz, se
          puede decir "enviar a" y el nombre, sin deletrear la direccion.
        </p>

        <ul data-nac-id="yuemail.contacts.list" style={{ listStyle: 'none', padding: 0, maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
          {props.contacts.length === 0 && (
            <li style={{ opacity: 0.6, padding: '8px 0' }}>Todavia no hay contactos. Agrega el primero abajo.</li>
          )}
          {props.contacts.map((c) => (
            <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <span>
                <strong>{c.name || '(sin nombre)'}</strong>
                <span style={{ opacity: 0.7 }}> &lt;{c.email}&gt;</span>
                {c.aliases.length > 0 && <span style={{ opacity: 0.5, fontSize: 12 }}> ({c.aliases.join(', ')})</span>}
                {c.source === 'inbox' && <span style={{ opacity: 0.45, fontSize: 11 }}> - de la bandeja</span>}
              </span>
              <button
                type="button"
                onClick={() => void props.onDelete(c.id)}
                aria-label={'Borrar contacto ' + (c.name || c.email)}
                data-nac-id="yuemail.contacts.btn-delete"
                data-nac-role="button"
                data-nac-action="delete_contact"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>

        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'block' }}>
            Nombre
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-nac-id="yuemail.contacts.name"
              data-nac-role="textbox"
              data-nac-action="set_contact_name"
            />
          </label>
          <label style={{ display: 'block' }}>
            Correo
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@dominio.com"
              data-nac-id="yuemail.contacts.email"
              data-nac-role="textbox"
              data-nac-action="set_contact_email"
            />
          </label>
          <label style={{ display: 'block' }}>
            Apodos (opcional, separados por coma)
            <input
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="maxi, maximi"
              data-nac-id="yuemail.contacts.aliases"
              data-nac-role="textbox"
              data-nac-action="set_contact_aliases"
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={props.onClose} data-nac-id="yuemail.contacts.btn-close" data-nac-role="button" data-nac-action="close_contacts">Cerrar</button>
          <button type="button" onClick={add} disabled={email.trim().length === 0} data-nac-id="yuemail.contacts.btn-add" data-nac-role="button" data-nac-action="add_contact">Agregar</button>
        </div>
      </div>
    </div>
  );
}
