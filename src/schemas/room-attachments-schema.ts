/**
 * Room Attachments Schema
 *
 * Why: Attachment metadata is scoped to the room and interviewer (`ownerField: 'interviewerId'`).
 * Ensures resumes and architecture diagrams are protected from unauthorized deletion or tampering.
 */
import type { CollectionSchema } from 'deepspace/schema'

export interface RoomAttachmentRecord {
  roomId: string
  interviewerId: string
  fileKey: string
  fileName: string
  fileSize: number
  fileType: string
  fileUrl: string
  [key: string]: unknown
}

export const roomAttachmentsSchema: CollectionSchema = {
  name: 'roomAttachments',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'interviewerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
    { name: 'fileKey', storage: 'text', interpretation: 'plain', required: true },
    { name: 'fileName', storage: 'text', interpretation: 'plain', required: true },
    { name: 'fileSize', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'fileType', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'fileUrl', storage: 'text', interpretation: 'plain', default: '' },
  ],
  ownerField: 'interviewerId',
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: false, create: false, update: false, delete: false },
    '*': { read: false, create: false, update: false, delete: false },
  },
}
