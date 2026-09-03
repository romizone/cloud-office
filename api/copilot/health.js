import { getApiKey } from '../../server/copilotCore.js'

export default function handler(req, res) {
  res.status(200).json({
    configured: Boolean(getApiKey()),
    label: 'DeepRomeo',
  })
}
