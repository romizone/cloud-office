import { vercelHandler } from '../../server/vercelAdapter.js'

export default vercelHandler((req) => `/api/auth/${req.query?.action || ''}`)
