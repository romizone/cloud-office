import { createContext, useContext } from 'react'
import { USER } from './brand.js'
import { initialsOf } from './auth.js'

export const GUEST = { name: 'Pengguna Office Romeo', short: '', initials: 'OR', email: 'pengguna@officeromeo.id', picture: '' }

/** Keeps the legacy USER constant in sync so existing components pick up the signed-in identity. */
export function applyUser(user) {
  const next = user
    ? { name: user.name || user.email || 'Pengguna', short: (user.name || '').split(' ')[0] || '', initials: initialsOf(user.name, user.email), email: user.email || '', picture: user.picture || '' }
    : { ...GUEST }
  Object.assign(USER, next)
  return next
}

export const UserContext = createContext({ user: null, mode: 'guest', logout: () => {} })
export const useUser = () => useContext(UserContext)
