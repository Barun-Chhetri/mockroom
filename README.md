# MockRoom — Live Collaborative Technical Interviewer

> Built with the **DeepSpace SDK** on Cloudflare Workers edge architecture.

MockRoom is a production-ready, full-stack collaborative technical interviewing platform. It provides a real-time multiplayer code workspace, live candidate presence, platform-enforced role permissions, private interviewer rubrics, R2 file attachments, and an AI interview copilot.

---

## 🚀 Live Workflow & Core Features

### 1. Landing & Interview Dashboard (`/` & `/home`)
- **Static Front Door (`/`):** Fast, SEO-optimized landing page served with zero auth or WebSocket overhead.
- **Dynamic Dashboard (`/home`):** Authenticated users can create an Interview Room (specifying title, language: TypeScript, JavaScript, Python, Java, and optional problem statement).
- **Dual Role Tracking:** Dashboard categorizes sessions into *"My Interviews (as Interviewer)"* and *"Joined Interviews (as Candidate)"* with live status badges (`waiting`, `active`, `completed`).
- **Shareable Candidate Invites:** Generating a room mints a unique alphanumeric invite code (`/join/:code`).

### 2. Live Interview Room Workspace (`/room/:id`)
- **Split-Screen Workspace:**
  - **Left/Main Pane (Shared):** Real-time collaborative code editor with line numbers, syntax styling, tab indentation, and live Yjs CRDT synchronization.
  - **Live Presence & Cursors:** Header and status bar broadcast real-time participant presence and line tracking via `PresenceRoom` (`usePresenceRoom`).
  - **Problem Statement Header (Shared):** Interviewers can edit the problem statement in real-time; candidates view it read-only.
- **Session Lifecycle:**
  - Status transitions: `waiting` ➔ `active` ➔ `completed`.
  - When marked `completed` by the interviewer, the candidate's editor is **strictly locked to read-only** at both the React UI and the server WebSocket (`AppYjsRoom`) layer.

### 3. Interviewer Panel (Role-Gated & Private)
- **Private Notes & Rubric:**
  - Structured 1–5 candidate competency scoring across **Problem Solving**, **Code Quality**, and **Communication**.
  - Final hiring recommendation selector: *Strong Hire*, *Hire*, *No Hire*, *Strong No Hire*, *Undecided*.
  - Freeform interviewer notes persisted in the `privateNotes` collection.
- **Attachments (R2 Storage):**
  - Interviewer can attach candidate resumes (PDF) or system architecture diagrams (PNG, JPG, SVG) scoped to the room.
- **AI Interview Copilot:**
  - Three interviewer-only Hono server actions in `worker.ts`:
    1. **Generate Hint:** Delivers a progressive, subtle pedagogical nudge without spoiling the full solution.
    2. **Generate Follow-up:** Suggests targeted edge case, scalability, and time/space complexity questions.
    3. **Generate Scorecard:** Synthesizes the candidate's final code buffer, rubric scores, and private notes into an executive-ready hire/no-hire evaluation.
  - One-click **+ Notes** button appends AI insights directly into private notes.
  - Persistent log history in `aiCopilotLogs`.

---

## 🔒 Strict Security & Platform RBAC Architecture

Security is enforced at the **DeepSpace SQLite Durable Object data layer**, never solely by hiding React UI elements:

| Collection | Owner Field | Collaborators | Read Policy | Update Policy | Delete Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `rooms` | `interviewerId` | `collaborators` | `'shared'` (Interviewer + Candidate) | `'shared'` | `'own'` (Interviewer only) |
| `privateNotes` | `interviewerId` | *None* | `'own'` (Interviewer only) | `'own'` | `'own'` |
| `rubrics` | `interviewerId` | *None* | `'own'` (Interviewer only) | `'own'` | `'own'` |
| `aiCopilotLogs` | `interviewerId` | *None* | `'own'` (Interviewer only) | `'own'` | `'own'` |
| `roomAttachments` | `interviewerId` | *None* | `'own'` (Interviewer only) | `'own'` | `'own'` |

- All `ownerField` columns are stamped with `userBound: true` and `immutable: true` to prevent ID spoofing.
- If a candidate client attempts to query `privateNotes`, `rubrics`, or `aiCopilotLogs` over the WebSocket or REST, the RecordRoom Durable Object evaluates `'own'` to `false` and drops the records before network transmission.
- AI Copilot routes (`/api/rooms/:id/ai/*`) explicitly verify `auth.userId === room.interviewerId` and immediately reject unauthorized requests with `403 Forbidden`.
- Completed room state downgrades the candidate's Yjs role in `resolveYjsRole` to `'viewer'`, preventing unauthorized code tampering after interview conclusion.

---

## 💳 DeepSpace Integrations & Billing

All paid integrations in `src/integrations.ts` are configured with `billing: 'user'`:
```ts
export const integrations = {
  anthropic: { billing: 'user' },
  openai: { billing: 'user' },
  google: { billing: 'user' },
  composio: { billing: 'user' },
}
```
Because billing is set to `'user'`, the caller's JWT is forwarded and charged to their own account quota. **No developer credit card or preloaded balance is required** to run or deploy MockRoom.

---

## ⚖️ Key Architectural Tradeoffs (Explicit Non-Goals)

### 1. Why No Live Code Execution / Sandboxing?
- **Cognitive Value in Interviews:** High-signal technical evaluations assess thought clarity, problem decomposition, communication, and mental trace execution — not trial-and-error print debugging.
- **Latency & Reliability:** Remote code execution containers introduce 2–5 second startup latencies, sandbox timeout errors, and complex package manager edge cases that disrupt conversational interview flow.
- **Security Boundary:** Sandboxing user-supplied arbitrary code requires complex VM isolation and egress filtering; keeping the workspace focused on collaborative CRDT text eliminates this attack surface entirely.

### 2. Why No In-App WebRTC Video or Audio?
- **Specialized Tooling:** Video and screen-sharing infrastructures (Zoom, Google Meet, Teams) already offer hardware-accelerated echo cancellation, noise suppression, and global low-latency TURN servers.
- **Performance & Battery:** Running WebRTC video streams inside the browser alongside a multiplayer CRDT code editor causes CPU throttling and frame drops on candidate laptops.
- **Focus:** Separating the audio channel keeps MockRoom lightweight, responsive, and resilient even over constrained mobile connections.

### 3. Why Built-in DeepSpace Stack Instead of External DBs?
- **Zero Cold Starts:** Cloudflare Workers + Durable Objects store SQLite tables right at the edge with zero external database connection latency or connection pool saturation.
- **Native Reactivity:** Mutations fan out over WebSockets in sub-milliseconds without requiring custom Redis pub/sub brokers or Socket.io servers.

---

## 🛠️ Verification & Test Suite

MockRoom includes an automated Vitest test suite covering:
1. **Schema & RBAC Isolation:** Validates `rooms`, `privateNotes`, `rubrics`, `aiCopilotLogs`, and `roomAttachments` permission levels and `userBound` guards.
2. **Multi-User Collaboration & Invites:** Tests invite code generation, candidate assignment, and prevention of multi-candidate hijackings.
3. **AI Copilot Security Gate:** Verifies unauthenticated calls return `401 Unauthorized` and candidate calls return `403 Forbidden`.

To run the test suite:
```bash
npm run test:unit
```

To run TypeScript validation:
```bash
npm run validate
```

To build for production:
```bash
npm run build
```

To deploy to `<name>.app.space`:
```bash
npx deepspace deploy
```
