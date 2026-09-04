import { useState } from 'react'
import { Link, Users, X } from 'lucide-react'
import { USER } from '../lib/brand.js'

const PEOPLE = [
  { name: USER.name, email: USER.email, initials: USER.initials, you: true },
  { name: 'Andi Pratama', email: 'andi@northstar.id', initials: 'AP' },
  { name: 'Sari Wijaya', email: 'sari@northstar.id', initials: 'SW' },
  { name: 'Budi Hartono', email: 'budi@northstar.id', initials: 'BH' },
]

const ROLE_LABEL = { edit: 'Dapat mengedit', view: 'Dapat melihat', review: 'Dapat meninjau' }

export default function ShareDialog({ title, link, onClose, onNotify, onShared }) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('edit')
  const [invited, setInvited] = useState([])
  const q = query.trim().toLowerCase()
  const matches = PEOPLE.filter((p) => !p.you
    && !invited.some((item) => item.email === p.email)
    && (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)))

  const invite = (person) => {
    setInvited((list) => list.some((item) => item.email === person.email) ? list : [...list, { ...person, role }])
    setQuery('')
    onNotify?.(`${person.name} diundang`)
  }

  const copyLink = () => {
    const href = link || location.href
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(href).then(
        () => onNotify?.('Tautan berbagi disalin'),
        () => onNotify?.('Tautan tidak dapat disalin'),
      )
    } else {
      onNotify?.('Tautan tidak dapat disalin')
    }
  }

  const send = () => {
    if (invited.length) onShared?.(invited)
    onNotify?.(invited.length ? `Undangan terkirim ke ${invited.length} orang` : 'Tidak ada orang yang diundang')
    onClose()
  }

  return (
    <div className="ms-modal" onClick={onClose} role="presentation">
      <div className="ms-dialog share-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bagikan">
        <header>
          <div>
            <strong>Bagikan</strong>
            <small>{title}</small>
          </div>
          <button onClick={onClose} aria-label="Tutup"><X size={16} /></button>
        </header>
        <div className="share-invite">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) { event.preventDefault(); invite(matches[0]) } }}
            placeholder="Tambahkan nama, grup, atau email"
          />
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="edit">Dapat mengedit</option>
            <option value="view">Dapat melihat</option>
            <option value="review">Dapat meninjau</option>
          </select>
        </div>
        {q && (
          <div className="share-matches">
            {matches.length === 0 && <p className="muted">Tidak ada orang yang cocok.</p>}
            {matches.map((person) => (
              <button key={person.email} onClick={() => invite(person)}>
                <span className="ms-avatar sm">{person.initials}</span>
                <span><b>{person.name}</b><small>{person.email}</small></span>
              </button>
            ))}
          </div>
        )}
        <p className="share-label">Orang dengan akses</p>
        {[PEOPLE[0], ...invited].map((person) => (
          <div className="share-person" key={person.email}>
            <span className="ms-avatar sm">{person.initials}</span>
            <span><b>{person.name}{person.you ? ' (Anda)' : ''}</b><small>{person.email}</small></span>
            <em>{person.you ? 'Pemilik' : ROLE_LABEL[person.role] || ROLE_LABEL.view}</em>
          </div>
        ))}
        <footer>
          <button className="ghost" onClick={copyLink}><Link size={14} /> Salin tautan</button>
          <button className="primary" onClick={send}><Users size={14} /> Kirim</button>
        </footer>
      </div>
    </div>
  )
}
