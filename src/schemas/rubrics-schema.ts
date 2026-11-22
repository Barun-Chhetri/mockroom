/**
 * Rubrics Schema
 *
 * Why: Structured rubrics and final hiring recommendations are strictly private to the interviewer.
 * Platform-enforced at the RecordRoom Durable Object layer with `ownerField: 'interviewerId'`
 * and `userBound: true` so candidates cannot view or tamper with scores.
 */
import type { CollectionSchema } from 'deepspace/schema'

export interface RubricRecord {
  roomId: string
  interviewerId: string
  problemSolving: number
  codeQuality: number
  communication: number
  summaryFeedback: string
  recommendation: 'strong_hire' | 'hire' | 'no_hire' | 'strong_no_hire' | 'undecided'
  [key: string]: unknown
}

export const rubricsSchema: CollectionSchema = {
  name: 'rubrics',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true },
    {
      name: 'interviewerId',
      storage: 'text',
      interpretation: 'plain',
      userBound: true,
      immutable: true,
    },
    { name: 'problemSolving', storage: 'number', interpretation: 'plain', default: 3 },
    { name: 'codeQuality', storage: 'number', interpretation: 'plain', default: 3 },
    { name: 'communication', storage: 'number', interpretation: 'plain', default: 3 },
    { name: 'summaryFeedback', storage: 'text', interpretation: 'plain', default: '' },
    {
      name: 'recommendation',
      storage: 'text',
      interpretation: {
        kind: 'select',
        options: ['strong_hire', 'hire', 'no_hire', 'strong_no_hire', 'undecided'],
      },
      default: 'undecided',
    },
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
