import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { RoomRecord } from '../schemas/rooms-schema'

export interface JoinRoomResult {
  roomId: string
  role: 'interviewer' | 'candidate'
  title: string
  language: string
}

export const joinRoom: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const inviteCode = typeof params.inviteCode === 'string' ? params.inviteCode.trim() : ''
  const userName = typeof params.userName === 'string' ? params.userName.trim() : 'Candidate'

  if (!inviteCode) {
    return { success: false, error: 'Invite code is required' }
  }

  // Find the room by inviteCode
  const queryRes = await tools.query<Record<string, unknown>>('rooms', {
    where: { inviteCode },
    limit: 1,
  })

  const records = (queryRes.data as { records?: Array<{ recordId: string; data: RoomRecord }> } | undefined)?.records
  if (!queryRes.success || !records || records.length === 0) {
    return { success: false, error: 'Interview room not found for this invite code' }
  }

  const room = records[0]
  const roomData = room.data

  // If the caller is the interviewer
  if (roomData.interviewerId === userId) {
    return {
      success: true,
      data: {
        roomId: room.recordId,
        role: 'interviewer',
        title: String(roomData.title ?? ''),
        language: String(roomData.language ?? 'typescript'),
      },
    }
  }

  // If candidate is already assigned and it is someone else
  if (roomData.candidateId && roomData.candidateId !== userId) {
    return {
      success: false,
      error: 'This interview room already has an assigned candidate',
    }
  }

  // Add the user to collaborators
  let collaboratorsList: string[] = []
  try {
    collaboratorsList = JSON.parse(String(roomData.collaborators || '[]'))
  } catch {
    collaboratorsList = []
  }

  if (!collaboratorsList.includes(userId)) {
    collaboratorsList.push(userId)
  }

  const patch: Partial<RoomRecord> = {
    candidateId: userId,
    candidateName: userName || String(roomData.candidateName || 'Candidate'),
    collaborators: JSON.stringify(collaboratorsList),
  }

  if (roomData.status === 'waiting') {
    patch.status = 'active'
  }

  const updateRes = await tools.update<RoomRecord>('rooms', room.recordId, patch)
  if (!updateRes.success) {
    return { success: false, error: updateRes.error || 'Failed to join interview room' }
  }

  return {
    success: true,
    data: {
      roomId: room.recordId,
      role: 'candidate',
      title: String(roomData.title ?? ''),
      language: String(roomData.language ?? 'typescript'),
    },
  }
}
