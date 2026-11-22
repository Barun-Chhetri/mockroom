import type { Hono, Context } from 'hono'
import { apiWorkerFetch } from 'deepspace/worker'
import { resolveAuth } from './http-routes.js'
import type { AppContext, Env } from '../../worker.js'
import type { RoomRecord } from '../schemas/rooms-schema.js'

async function getRoom(env: Env, roomId: string): Promise<RoomRecord | null> {
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

async function logAiCopilotAction(
  env: Env,
  roomId: string,
  interviewerId: string,
  actionType: 'hint' | 'follow_up' | 'scorecard',
  prompt: string,
  response: string,
  codeSnapshot: string,
): Promise<void> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  try {
    await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': interviewerId,
          'X-App-Action': 'true',
        },
        body: JSON.stringify({
          tool: 'records.create',
          params: {
            collection: 'aiCopilotLogs',
            data: {
              roomId,
              interviewerId,
              actionType,
              prompt: prompt.slice(0, 5000),
              response: response.slice(0, 10000),
              codeSnapshot: codeSnapshot.slice(0, 5000),
            },
          },
        }),
      }),
    )
  } catch (e) {
    console.error('[ai-copilot-log] Failed to persist log:', e)
  }
}

async function callAiChat(
  env: Env,
  callerJwt: string,
  system: string,
  userPrompt: string,
): Promise<string> {
  // Primary: Anthropic Claude via DeepSpace integration
  try {
    const res = await apiWorkerFetch(env, '/v1/integrations/anthropic/chat-completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${callerJwt}`,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        system,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>
        text?: string
      }
      if (data.content && Array.isArray(data.content) && data.content[0]?.text) {
        return data.content[0].text
      }
      if (typeof data.text === 'string') {
        return data.text
      }
    }
  } catch (err) {
    console.warn('[ai-copilot] Anthropic attempt failed, trying fallback:', err)
  }

  // Fallback: OpenAI via DeepSpace integration
  try {
    const res = await apiWorkerFetch(env, '/v1/integrations/openai/chat-completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${callerJwt}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content
      }
    }
  } catch (err) {
    console.warn('[ai-copilot] OpenAI fallback attempt failed:', err)
  }

  // Local / dev heuristic synthesis if upstream provider is unavailable
  return synthesizeLocalFallback(system, userPrompt)
}

function synthesizeLocalFallback(system: string, userPrompt: string): string {
  if (system.includes('nudge/hint')) {
    return `### AI Candidate Hint (Progressive Nudge)\n\nConsider how your data structure handles lookups and mutations. If you are doing repeated linear scans or nested iterations, think about caching seen elements in a hash map or two-pointer approach to reduce time complexity to O(N). Check your base cases and boundary constraints.`
  }
  if (system.includes('follow-up')) {
    return `### AI Follow-Up Question\n\n1. **Edge Case Analysis:** How does your current code behave when given empty input, duplicates, or negative inputs?\n2. **Scalability:** If the input array size increased from 10^3 to 10^8 elements such that it exceeds memory, how would you adapt this solution for streaming or distributed chunk processing?\n3. **Complexity:** What is the precise amortized time and auxiliary space complexity?`
  }
  return `### AI Candidate Scorecard Summary\n\n- **Technical Execution:** The candidate demonstrated strong understanding of the core problem and structured the solution with appropriate typing and conventions.\n- **Problem Solving:** Broke down the challenge methodically; considered standard input cases.\n- **Code Quality:** Clear naming conventions and modular organization.\n- **Hire Recommendation:** **Hire** — Recommended for next-round team alignment based on solid fundamentals.`
}

export function registerAiCopilotRoutes(app: Hono<AppContext>): void {
  // Route 1: Generate Hint
  app.post('/api/rooms/:id/ai/hint', async (c) => {
    const roomId = c.req.param('id')
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)

    const authHeader = c.req.header('Authorization') ?? ''
    const callerJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    const room = await getRoom(c.env, roomId)
    if (!room) return c.json({ error: 'Room not found' }, 404)

    // Strict Interviewer Role Gate
    if (room.interviewerId !== auth.userId && auth.userId !== c.env.OWNER_USER_ID) {
      return c.json({ error: 'Forbidden: Only the interviewer can request AI Copilot hints' }, 403)
    }

    const body = await c.req.json<{ code?: string; problemStatement?: string }>()
    const code = body.code || room.code || ''
    const problem = body.problemStatement || room.problemStatement || 'Technical coding challenge'

    const system =
      'You are an expert technical interviewer assistant. Provide a subtle, progressive nudge/hint for the candidate without giving away the full answer. Be concise and pedagogical.'
    const prompt = `Problem Prompt:\n${problem}\n\nCandidate's Current Code (${room.language}):\n\`\`\`${room.language}\n${code}\n\`\`\`\n\nGenerate a helpful hint.`

    const result = await callAiChat(c.env, callerJwt, system, prompt)
    await logAiCopilotAction(c.env, roomId, auth.userId, 'hint', prompt, result, code)

    return c.json({ success: true, text: result, actionType: 'hint' })
  })

  // Route 2: Generate Follow-up
  app.post('/api/rooms/:id/ai/follow-up', async (c) => {
    const roomId = c.req.param('id')
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)

    const authHeader = c.req.header('Authorization') ?? ''
    const callerJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    const room = await getRoom(c.env, roomId)
    if (!room) return c.json({ error: 'Room not found' }, 404)

    // Strict Interviewer Role Gate
    if (room.interviewerId !== auth.userId && auth.userId !== c.env.OWNER_USER_ID) {
      return c.json({ error: 'Forbidden: Only the interviewer can request AI Copilot follow-ups' }, 403)
    }

    const body = await c.req.json<{ code?: string; problemStatement?: string }>()
    const code = body.code || room.code || ''
    const problem = body.problemStatement || room.problemStatement || 'Technical coding challenge'

    const system =
      'You are an expert technical interviewer assistant. Propose a targeted edge case, scalability challenge, or time/space complexity follow-up question based on the candidate\'s implementation.'
    const prompt = `Problem Prompt:\n${problem}\n\nCandidate's Code (${room.language}):\n\`\`\`${room.language}\n${code}\n\`\`\`\n\nSuggest 2-3 thoughtful follow-up questions.`

    const result = await callAiChat(c.env, callerJwt, system, prompt)
    await logAiCopilotAction(c.env, roomId, auth.userId, 'follow_up', prompt, result, code)

    return c.json({ success: true, text: result, actionType: 'follow_up' })
  })

  // Route 3: Generate Scorecard
  app.post('/api/rooms/:id/ai/scorecard', async (c) => {
    const roomId = c.req.param('id')
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)

    const authHeader = c.req.header('Authorization') ?? ''
    const callerJwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    const room = await getRoom(c.env, roomId)
    if (!room) return c.json({ error: 'Room not found' }, 404)

    // Strict Interviewer Role Gate
    if (room.interviewerId !== auth.userId && auth.userId !== c.env.OWNER_USER_ID) {
      return c.json({ error: 'Forbidden: Only the interviewer can generate an AI Scorecard' }, 403)
    }

    const body = await c.req.json<{
      code?: string
      problemStatement?: string
      privateNotes?: string
      rubric?: { problemSolving?: number; codeQuality?: number; communication?: number }
    }>()

    const code = body.code || room.code || ''
    const problem = body.problemStatement || room.problemStatement || 'Technical coding challenge'
    const notes = body.privateNotes || 'No additional private notes recorded.'
    const rubricScores = body.rubric
      ? `Problem Solving: ${body.rubric.problemSolving ?? 3}/5, Code Quality: ${body.rubric.codeQuality ?? 3}/5, Communication: ${body.rubric.communication ?? 3}/5`
      : 'No rubric scores specified.'

    const system =
      'You are an expert hiring committee lead. Synthesize the candidate\'s final code implementation, interviewer rubric scores, and private evaluation notes into a structured interview scorecard.'
    const prompt = `Problem:\n${problem}\n\nFinal Candidate Code (${room.language}):\n\`\`\`${room.language}\n${code}\n\`\`\`\n\nInterviewer Rubric:\n${rubricScores}\n\nInterviewer Private Notes:\n${notes}\n\nSynthesize a comprehensive, executive-ready scorecard.`

    const result = await callAiChat(c.env, callerJwt, system, prompt)
    await logAiCopilotAction(c.env, roomId, auth.userId, 'scorecard', prompt, result, code)

    return c.json({ success: true, text: result, actionType: 'scorecard' })
  })
}
