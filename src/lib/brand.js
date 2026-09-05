export const TENANT = 'Northstar Studio'
export const USER = { name: 'Rominur Ismanto', short: 'Rominur', initials: 'RI', email: 'rominur@northstar.id' }
export const SKU = { name: 'Office Romeo F3', detail: 'Aplikasi web & seluler · OneDrive 2 GB' }

// Only four apps are surfaced in the launcher and on the home page.
export const APPS = [
  { id: 'word', label: 'Word', route: '#/', create: 'doc', color: '#185ABD' },
  { id: 'excel', label: 'Excel', route: '#/', create: 'sheet', color: '#107C41' },
  { id: 'powerpoint', label: 'PowerPoint', route: '#/', create: 'slides', color: '#C43E1C' },
  { id: 'pdf', label: 'PDF', route: '#/', create: 'pdf', color: '#D13438' },
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
