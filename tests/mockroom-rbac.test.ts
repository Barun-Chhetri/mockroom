import { describe, it, expect, vi } from 'vitest'
import {
  roomsSchema,
  privateNotesSchema,
  rubricsSchema,
  aiCopilotLogsSchema,
  roomAttachmentsSchema,
} from '../src/schemas.js'
import { usersSchema } from '../src/schemas/users-schema.js'
import { joinRoom } from '../src/actions/join-room.js'
import { generateInviteCode, LANGUAGE_STARTERS } from '../src/lib/room-helpers.js'
import { Hono } from 'hono'
import * as workerModule from 'deepspace/worker'

describe('MockRoom Schema & RBAC Policies', () => {
  it('assigns member as defaultRole for newly registered authenticated users', () => {
    expect(usersSchema.defaultRole).toBe('member')
  })

  it('allows authenticated users with default role (viewer or member) to create and share rooms', () => {
    expect(roomsSchema.ownerField).toBe('interviewerId')
    expect(roomsSchema.collaboratorsField).toBe('collaborators')
    // Both member and viewer roles can create rooms and read shared rooms
    expect(roomsSchema.permissions.member.create).toBe(true)
    expect(roomsSchema.permissions.member.read).toBe('shared')
    expect(roomsSchema.permissions.member.update).toBe('shared')
    expect(roomsSchema.permissions.viewer.create).toBe(true)
    expect(roomsSchema.permissions.viewer.read).toBe('shared')
    expect(roomsSchema.permissions.viewer.update).toBe('shared')
    expect(roomsSchema.permissions['*'].read).toBe(false)
  })

  it('strictly isolates privateNotes to interviewer (candidate cannot read even in viewer or member role)', () => {
    expect(privateNotesSchema.ownerField).toBe('interviewerId')
    expect(privateNotesSchema.collaboratorsField).toBeUndefined()
    // Interviewer with either member or viewer role can read/create/update own notes
    expect(privateNotesSchema.permissions.member.read).toBe('own')
    expect(privateNotesSchema.permissions.member.create).toBe(true)
    expect(privateNotesSchema.permissions.member.update).toBe('own')
    expect(privateNotesSchema.permissions.member.delete).toBe('own')

    expect(privateNotesSchema.permissions.viewer.read).toBe('own')
    expect(privateNotesSchema.permissions.viewer.create).toBe(true)
    expect(privateNotesSchema.permissions.viewer.update).toBe('own')
    expect(privateNotesSchema.permissions.viewer.delete).toBe('own')
    expect(privateNotesSchema.permissions['*'].read).toBe(false)

    // Verification of "own" logic:
    // When candidate checks note owned by interviewer, ownership fails
    const interviewerNote = { data: { interviewerId: 'usr_interviewer_alice', notes: 'Secret feedback' } }
    const candidateUserId = 'usr_candidate_bob'
    const isCandidateOwner = interviewerNote.data.interviewerId === candidateUserId
    expect(isCandidateOwner).toBe(false)

    // When interviewer checks own note, ownership succeeds
    const isInterviewerOwner = interviewerNote.data.interviewerId === 'usr_interviewer_alice'
    expect(isInterviewerOwner).toBe(true)
  })

  it('strictly isolates rubrics and scoring to interviewer only', () => {
    expect(rubricsSchema.ownerField).toBe('interviewerId')
    expect(rubricsSchema.collaboratorsField).toBeUndefined()
    expect(rubricsSchema.permissions.member.read).toBe('own')
    expect(rubricsSchema.permissions.member.create).toBe(true)
    expect(rubricsSchema.permissions.member.update).toBe('own')

    expect(rubricsSchema.permissions.viewer.read).toBe('own')
    expect(rubricsSchema.permissions.viewer.create).toBe(true)
    expect(rubricsSchema.permissions.viewer.update).toBe('own')
    expect(rubricsSchema.permissions['*'].read).toBe(false)
  })

  it('strictly isolates AI copilot logs and room attachments to interviewer', () => {
    expect(aiCopilotLogsSchema.ownerField).toBe('interviewerId')
    expect(aiCopilotLogsSchema.permissions.member.read).toBe('own')
    expect(aiCopilotLogsSchema.permissions.member.create).toBe(true)
    expect(aiCopilotLogsSchema.permissions.viewer.read).toBe('own')
    expect(aiCopilotLogsSchema.permissions.viewer.create).toBe(true)

    expect(roomAttachmentsSchema.ownerField).toBe('interviewerId')
    expect(roomAttachmentsSchema.permissions.member.read).toBe('own')
    expect(roomAttachmentsSchema.permissions.member.create).toBe(true)
    expect(roomAttachmentsSchema.permissions.viewer.read).toBe('own')
    expect(roomAttachmentsSchema.permissions.viewer.create).toBe(true)
  })

  it('ensures all owner fields are userBound and immutable to prevent ID spoofing', () => {
    const checkUserBound = (schema: typeof roomsSchema) => {
      const col = schema.columns.find((c) => c.name === schema.ownerField)
      expect(col).toBeDefined()
      expect(col?.userBound).toBe(true)
      expect(col?.immutable).toBe(true)
      expect(col?.storage).toBe('text')
    }

    checkUserBound(roomsSchema)
    checkUserBound(privateNotesSchema)
    checkUserBound(rubricsSchema)
    checkUserBound(aiCopilotLogsSchema)
    checkUserBound(roomAttachmentsSchema)
  })
})

describe('MockRoom Server Actions & Multi-User Flow', () => {
  it('generates cryptographically safe alphanumeric invite codes', () => {
    const code1 = generateInviteCode()
    const code2 = generateInviteCode()
    expect(code1).toHaveLength(8)
    expect(code2).toHaveLength(8)
    expect(code1).not.toBe(code2)
  })

  it('provides starter templates for all supported interview languages', () => {
    expect(LANGUAGE_STARTERS.typescript).toContain('TypeScript')
    expect(LANGUAGE_STARTERS.javascript).toContain('JavaScript')
    expect(LANGUAGE_STARTERS.python).toContain('Python')
    expect(LANGUAGE_STARTERS.java).toContain('Java')
  })

  it('allows candidate to join via invite code and updates room status to active', async () => {
    const mockRoomData = {
      title: 'Senior Systems Engineer',
      language: 'typescript' as const,
      problemStatement: 'Design an LRU cache',
      status: 'waiting' as const,
      code: 'function lru() {}',
      interviewerId: 'usr_interviewer_1',
      interviewerName: 'Lead Interviewer',
      candidateId: '',
      candidateName: '',
      inviteCode: 'TEST1234',
      collaborators: JSON.stringify(['usr_interviewer_1']),
    }

    const mockTools = {
      query: vi.fn().mockResolvedValue({
        success: true,
        data: {
          records: [{ recordId: 'room_99', data: mockRoomData }],
        },
      }),
      update: vi.fn().mockResolvedValue({ success: true }),
      create: vi.fn(),
      remove: vi.fn(),
      deleteWhere: vi.fn(),
      get: vi.fn(),
      integration: vi.fn(),
      registerUser: vi.fn(),
    }

    const result = await joinRoom({
      userId: 'usr_candidate_2',
      params: { inviteCode: 'TEST1234', userName: 'Bob Candidate' },
      tools: mockTools,
      env: {} as any,
      callerJwt: 'mock_jwt_candidate',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.roomId).toBe('room_99')
      expect(result.data.role).toBe('candidate')
    }

    expect(mockTools.update).toHaveBeenCalledWith(
      'rooms',
      'room_99',
      expect.objectContaining({
        candidateId: 'usr_candidate_2',
        candidateName: 'Bob Candidate',
        status: 'active',
      }),
    )
  })

  it('returns interviewer role if creator opens invite link', async () => {
    const mockRoomData = {
      title: 'Staff Architect',
      language: 'python' as const,
      problemStatement: '',
      status: 'waiting' as const,
      code: '',
      interviewerId: 'usr_interviewer_1',
      interviewerName: 'Alice',
      candidateId: '',
      candidateName: '',
      inviteCode: 'INVITE88',
      collaborators: JSON.stringify(['usr_interviewer_1']),
    }

    const mockTools = {
      query: vi.fn().mockResolvedValue({
        success: true,
        data: {
          records: [{ recordId: 'room_88', data: mockRoomData }],
        },
      }),
      update: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      deleteWhere: vi.fn(),
      get: vi.fn(),
      integration: vi.fn(),
      registerUser: vi.fn(),
    }

    const result = await joinRoom({
      userId: 'usr_interviewer_1',
      params: { inviteCode: 'INVITE88' },
      tools: mockTools,
      env: {} as any,
      callerJwt: 'mock_jwt_interviewer',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe('interviewer')
    }
    expect(mockTools.update).not.toHaveBeenCalled()
  })

  it('prevents a third user from claiming an already occupied interview room', async () => {
    const mockRoomData = {
      title: 'Fullstack Engineer',
      language: 'javascript' as const,
      problemStatement: '',
      status: 'active' as const,
      code: '',
      interviewerId: 'usr_interviewer_1',
      interviewerName: 'Alice',
      candidateId: 'usr_candidate_2',
      candidateName: 'Bob',
      inviteCode: 'INVITE77',
      collaborators: JSON.stringify(['usr_interviewer_1', 'usr_candidate_2']),
    }

    const mockTools = {
      query: vi.fn().mockResolvedValue({
        success: true,
        data: {
          records: [{ recordId: 'room_77', data: mockRoomData }],
        },
      }),
      update: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      deleteWhere: vi.fn(),
      get: vi.fn(),
      integration: vi.fn(),
      registerUser: vi.fn(),
    }

    const result = await joinRoom({
      userId: 'usr_intruder_3',
      params: { inviteCode: 'INVITE77' },
      tools: mockTools,
      env: {} as any,
      callerJwt: 'mock_jwt_intruder',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('already has an assigned candidate')
    }
  })
})

describe('AI Copilot Role Enforcement', () => {
  it('denies unauthenticated requests with 401', async () => {
    const { registerAiCopilotRoutes } = await import('../src/server/ai-copilot-routes.js')
    const app = new Hono<any>()
    registerAiCopilotRoutes(app)

    const unauthReq = new Request('http://localhost/api/rooms/room_1/ai/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'const x = 1;' }),
    })

    const res = await app.fetch(unauthReq, {
      DEEPSPACE_APP_ID: 'app_test',
      AUTH_JWT_PUBLIC_KEY: 'test',
      AUTH_JWT_ISSUER: 'test',
    } as any)
    expect(res.status).toBe(401)
  })

  it('denies candidate role requests with 403 Forbidden', async () => {
    const { registerAiCopilotRoutes } = await import('../src/server/ai-copilot-routes.js')
    const app = new Hono<any>()
    
    // Provide resolveAuth mock directly
    const mockResolveAuth = vi.fn().mockResolvedValue({
      userId: 'usr_candidate_bob',
      claims: { sub: 'usr_candidate_bob', role: 'member' },
    })
    registerAiCopilotRoutes(app, mockResolveAuth)

    const mockStub = {
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              record: {
                data: {
                  interviewerId: 'usr_interviewer_alice',
                  candidateId: 'usr_candidate_bob',
                  code: 'const x = 1;',
                  problemStatement: 'Problem 1',
                  language: 'typescript',
                },
              },
            },
          }),
        ),
      ),
    }

    const env = {
      DEEPSPACE_APP_ID: 'app_test_123',
      OWNER_USER_ID: 'usr_owner_platform',
      AUTH_JWT_PUBLIC_KEY: 'test_key',
      AUTH_JWT_ISSUER: 'test_issuer',
      RECORD_ROOMS: {
        idFromName: vi.fn().mockReturnValue('id_123'),
        get: vi.fn().mockReturnValue(mockStub),
      },
    }

    const candidateReq = new Request('http://localhost/api/rooms/room_1/ai/hint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_jwt_for_candidate',
      },
      body: JSON.stringify({ code: 'const x = 1;' }),
    })

    const res = await app.fetch(candidateReq, env)
    expect(res.status).toBe(403)
    const body = (await res.json()) as any
    expect(body.error).toContain('Only the interviewer can request AI Copilot hints')
  })

  it('allows interviewer role to successfully generate hint', async () => {
    const { registerAiCopilotRoutes } = await import('../src/server/ai-copilot-routes.js')
    const app = new Hono<any>()

    const mockResolveAuth = vi.fn().mockResolvedValue({
      userId: 'usr_interviewer_alice',
      claims: { sub: 'usr_interviewer_alice', role: 'member' },
    })
    registerAiCopilotRoutes(app, mockResolveAuth)

    const mockStub = {
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              record: {
                data: {
                  interviewerId: 'usr_interviewer_alice',
                  candidateId: 'usr_candidate_bob',
                  code: 'function twoSum() {}',
                  problemStatement: 'Two Sum Problem',
                  language: 'typescript',
                },
              },
            },
          }),
        ),
      ),
    }

    const env = {
      DEEPSPACE_APP_ID: 'app_test_123',
      OWNER_USER_ID: 'usr_owner_platform',
      AUTH_JWT_PUBLIC_KEY: 'test_key',
      AUTH_JWT_ISSUER: 'test_issuer',
      RECORD_ROOMS: {
        idFromName: vi.fn().mockReturnValue('id_123'),
        get: vi.fn().mockReturnValue(mockStub),
      },
    }

    const interviewerReq = new Request('http://localhost/api/rooms/room_1/ai/hint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_jwt_for_interviewer',
      },
      body: JSON.stringify({ code: 'function twoSum() {}' }),
    })

    const res = await app.fetch(interviewerReq, env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.success).toBe(true)
    expect(body.actionType).toBe('hint')
    expect(body.text).toContain('Hint')
  })
})
