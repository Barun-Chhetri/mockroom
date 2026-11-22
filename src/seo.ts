import { APP_NAME } from './constants'

declare const __DEEPSPACE_SITE_ORIGIN__: string | undefined

export const seo = {
  title: 'MockRoom — Live Collaborative Technical Interviewer',
  description:
    'Real-time collaborative technical interviews on DeepSpace: multiplayer code editor, role-gated rubrics, R2 file attachments, and AI interview copilot.',
  origin: typeof __DEEPSPACE_SITE_ORIGIN__ === 'string' ? __DEEPSPACE_SITE_ORIGIN__ : 'http://localhost',
  noindex: false,
}
