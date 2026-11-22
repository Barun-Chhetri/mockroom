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
    viewer: { read: false, create: false, update: false, delete: false },
    '*': { read: false, create: false, update: false, delete: false },
  },
}
