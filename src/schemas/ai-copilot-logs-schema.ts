/**
 * AI Copilot Logs Schema
 *
 * Why: AI Copilot prompts, responses, and scorecards are interviewer-private records.
 * Secured with `ownerField: 'interviewerId'` and `userBound: true` to prevent leakage to candidates.
 */
import type { CollectionSchema } from 'deepspace/schema'

export interface AiCopilotLogRecord {
  roomId: string
  interviewerId: string
  actionType: 'hint' | 'follow_up' | 'scorecard'
  prompt: string
  response: string
  codeSnapshot: string
  [key: string]: unknown
}

export const aiCopilotLogsSchema: CollectionSchema = {
  name: 'aiCopilotLogs',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'interviewerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
    {
      name: 'actionType',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['hint', 'follow_up', 'scorecard'],
      },
      required: true,
    },
    { name: 'prompt', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'response', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'codeSnapshot', storage: 'text', interpretation: 'plain', default: '' },
  ],
  ownerField: 'interviewerId',
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
    '*': { read: false, create: false, update: false, delete: false },
  },
}
