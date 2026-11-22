/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { roomsSchema } from './schemas/rooms-schema'
import { privateNotesSchema } from './schemas/private-notes-schema'
import { rubricsSchema } from './schemas/rubrics-schema'
import { aiCopilotLogsSchema } from './schemas/ai-copilot-logs-schema'
import { roomAttachmentsSchema } from './schemas/room-attachments-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  roomsSchema,
  privateNotesSchema,
  rubricsSchema,
  aiCopilotLogsSchema,
  roomAttachmentsSchema,
]

export * from './schemas/rooms-schema'
export * from './schemas/private-notes-schema'
export * from './schemas/rubrics-schema'
export * from './schemas/ai-copilot-logs-schema'
export * from './schemas/room-attachments-schema'
