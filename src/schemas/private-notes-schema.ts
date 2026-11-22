/**
 * Private Notes Schema
 *
 * Why: Private notes are strictly owned by the interviewer (`ownerField: 'interviewerId'`).
 * With `userBound: true` and `permissions.member: { read: 'own' }`, non-interviewer callers
 * (including candidates) receive zero rows or 403 at the RecordRoom Durable Object layer,
 * ensuring notes never cross the network boundary to unauthorized clients.
 */
import type { CollectionSchema } from 'deepspace/schema'

export interface PrivateNoteRecord {
  roomId: string
  interviewerId: string
  notes: string
  [key: string]: unknown
}

export const privateNotesSchema: CollectionSchema = {
  name: 'privateNotes',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'interviewerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
    { name: 'notes', storage: 'text', interpretation: 'plain', default: '' },
  ],
  ownerField: 'interviewerId',
  uniqueOn: ['roomId', 'interviewerId'],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: 'own', create: true, update: 'own', delete: 'own' },
    '*': { read: false, create: false, update: false, delete: false },
  },
}
