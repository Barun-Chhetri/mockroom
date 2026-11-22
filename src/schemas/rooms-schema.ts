import type { CollectionSchema } from 'deepspace/schema'

export interface RoomRecord {
  title: string
  language: 'javascript' | 'typescript' | 'python' | 'java'
  problemStatement: string
  status: 'waiting' | 'active' | 'completed'
  code: string
  interviewerId: string
  interviewerName: string
  candidateId: string
  candidateName: string
  inviteCode: string
  collaborators: string // JSON array of user IDs
  [key: string]: unknown
}

export const roomsSchema: CollectionSchema = {
  name: 'rooms',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'language',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['javascript', 'typescript', 'python', 'java'],
      },
      default: 'typescript',
    },
    { name: 'problemStatement', storage: 'text', interpretation: 'plain', default: '' },
    {
      name: 'status',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['waiting', 'active', 'completed'],
      },
      default: 'waiting',
    },
    { name: 'code', storage: 'text', interpretation: 'plain', default: '' },
    {
      name: 'interviewerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
    { name: 'interviewerName', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'candidateId', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'candidateName', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'inviteCode', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'collaborators',
      storage: 'text',
      interpretation: { kind: 'json' },
      default: '[]',
    },
  ],
  ownerField: 'interviewerId',
  collaboratorsField: 'collaborators',
  uniqueOn: ['inviteCode'],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'shared', create: true, update: 'shared', delete: 'own' },
    viewer: { read: false, create: false, update: false, delete: false },
    '*': { read: false, create: false, update: false, delete: false },
  },
}
