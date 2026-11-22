/**
 * WebSocket routing for app-owned Durable Objects.
 *
 * Caller identity in query parameters and headers is never trusted. Routes
 * scrub it and forward verified JWT identity in internal-only headers; the
 * rooms-aware Yjs route additionally resolves an application role from
 * the rooms collection.
 */

import type { Context, Hono } from 'hono'
import { authenticatedRoomRequest, resolveAppRole, verifyJwt } from 'deepspace/worker'
import type { JwtVerifierConfig, VerifyResult } from 'deepspace/worker'
import type { AppContext, Env } from '../../worker.js'
import type { RoomRecord } from '../schemas/rooms-schema.js'

function jwtConfig(env: Env): JwtVerifierConfig {
  return { publicKey: env.AUTH_JWT_PUBLIC_KEY, issuer: env.AUTH_JWT_ISSUER }
}

function wsRoute(
  doNamespace: (env: Env) => DurableObjectNamespace,
  extraIdentity?: (auth: VerifyResult, env: Env) => { role?: string } | Promise<{ role?: string }>,
) {
  return async (c: Context<AppContext>) => {
    const id = c.req.param('roomId') ?? c.req.param('docId') ?? c.req.param('scopeId')
    if (!id) return new Response('Not found', { status: 404 })
    const url = new URL(c.req.url)
    const token = url.searchParams.get('token')

    let auth: VerifyResult | null = null
    if (token) {
      auth = (await verifyJwt(jwtConfig(c.env), token)).result
      if (!auth) return new Response('Unauthorized', { status: 401 })
    }
    const roomRequest = authenticatedRoomRequest(
      c.req.raw,
      auth,
      auth ? await extraIdentity?.(auth, c.env) : undefined,
    )

    const namespace = doNamespace(c.env)
    const stub = namespace.get(namespace.idFromName(id))
    return stub.fetch(roomRequest)
  }
}

type YjsRole = 'admin' | 'member' | 'viewer'

async function getRoomForAccess(env: Env, roomId: string): Promise<RoomRecord | null> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  try {
    const res = await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': env.OWNER_USER_ID,
          'X-App-Action': 'true',
        },
        body: JSON.stringify({
          tool: 'records.get',
          params: { collection: 'rooms', recordId: roomId },
        }),
      }),
    )
    const json = (await res.json()) as {
      success?: boolean
      data?: { record?: { data?: RoomRecord } }
    }
    if (json.success && json.data?.record?.data) {
      return json.data.record.data
    }
    return null
  } catch {
    return null
  }
}

/**
 * Resolves the authenticated user's authorization role for a Yjs CRDT document.
 *
 * Why: Role resolution is enforced at the WebSocket connection handshake:
 * 1. Interviewer/Owner gets 'admin' (full read/write and management rights).
 * 2. Candidate gets 'member' (read/write collaborative editing) while the room is 'waiting' or 'active'.
 * 3. Once room status transitions to 'completed', candidate is downgraded to 'viewer' (strictly read-only
 *    at the CRDT protocol layer, preventing WebSocket tampering regardless of client UI state).
 * 4. Non-participants return null, causing the WebSocket upgrade to reject with 403 Forbidden.
 */
async function resolveYjsRole(
  env: Env,
  docId: string,
  userId: string,
): Promise<YjsRole | null> {
  const room = await getRoomForAccess(env, docId)
  if (room) {
    if (room.interviewerId === userId || userId === env.OWNER_USER_ID) {
      return 'admin'
    }

    if (room.candidateId === userId) {
      return room.status === 'completed' ? 'viewer' : 'member'
    }

    let collaborators: string[] = []
    try {
      collaborators = JSON.parse(String(room.collaborators || '[]'))
    } catch {
      collaborators = []
    }
    if (collaborators.includes(userId)) {
      return room.status === 'completed' ? 'viewer' : 'member'
    }

    return null
  }

  return 'member'
}

export function registerRealtimeRoutes(app: Hono<AppContext>): void {
  app.get(
    '/ws/:roomId',
    wsRoute((env) => env.RECORD_ROOMS),
  )

  app.get('/ws/yjs/:docId', async (c) => {
    const docId = c.req.param('docId')
    const url = new URL(c.req.url)
    const token = url.searchParams.get('token')
    const auth = token ? (await verifyJwt(jwtConfig(c.env), token)).result : null
    if (!auth) return new Response('Unauthorized', { status: 401 })

    const role = await resolveYjsRole(c.env, docId, auth.userId)
    if (!role) return new Response('Forbidden', { status: 403 })

    const roomRequest = authenticatedRoomRequest(c.req.raw, auth, { role })

    const stub = c.env.YJS_ROOMS.get(c.env.YJS_ROOMS.idFromName(docId))
    return stub.fetch(roomRequest)
  })

  app.get(
    '/ws/canvas/:docId',
    wsRoute(
      (env) => env.CANVAS_ROOMS,
      async (auth, env) => ({ role: await resolveAppRole(env, auth.userId) }),
    ),
  )

  app.get(
    '/ws/presence/:scopeId',
    wsRoute((env) => env.PRESENCE_ROOMS),
  )

  app.get(
    '/ws/cron/:roomId',
    wsRoute(
      (env) => env.CRON_ROOMS,
      async (auth, env) => ({ role: await resolveAppRole(env, auth.userId) }),
    ),
  )

  app.get(
    '/ws/jobs/:roomId',
    wsRoute((env) => env.JOB_ROOMS),
  )
}
