export const TENANT = 'Northstar Studio'
export const USER = { name: 'Rominur Ismanto', short: 'Rominur', initials: 'RI', email: 'rominur@northstar.id' }
export const SKU = { name: 'Microsoft 365 F3', detail: 'Aplikasi web & seluler · OneDrive 2 GB' }

export const APPS = [
  { id: 'word', label: 'Word', route: '#/', create: 'doc', color: '#185ABD' },
  { id: 'excel', label: 'Excel', route: '#/', create: 'sheet', color: '#107C41' },
  { id: 'powerpoint', label: 'PowerPoint', route: '#/', create: 'slides', color: '#C43E1C' },
  { id: 'outlook', label: 'Outlook', route: '#/outlook', color: '#0F6CBD' },
  { id: 'teams', label: 'Teams', route: '#/teams', color: '#5B5FC7' },
  { id: 'onedrive', label: 'OneDrive', route: '#/onedrive', color: '#0078D4' },
  { id: 'copilot', label: 'Copilot', route: '#/copilot', color: '#5B5FC7' },
  { id: 'sharepoint', label: 'SharePoint', route: '#/sharepoint', color: '#038387' },
]

export const EXT = { doc: 'docx', sheet: 'xlsx', slides: 'pptx', pdf: 'pdf' }
export const APP_NAME = { doc: 'Word', sheet: 'Excel', slides: 'PowerPoint', pdf: 'Adobe PDF' }
export const APP_ACCENT = { doc: 'word', sheet: 'excel', slides: 'ppt', pdf: 'pdf' }

export function greeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}
