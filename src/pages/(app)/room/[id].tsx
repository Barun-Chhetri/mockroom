import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  useAuthProfileReady,
  useQuery,
  useMutations,
  useYjsText,
  usePresenceRoom,
} from 'deepspace'
import {
  Code2,
  Users,
  Copy,
  Check,
  Play,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  FileQuestion,
  Award,
  Loader2,
  ArrowLeft,
  Settings,
} from 'lucide-react'
import {
  Button,
  Input,
  Textarea,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from '@/components/ui'
import type { RoomRecord } from '@/schemas/rooms-schema'
import { LANGUAGE_STARTERS, type SupportedLanguage } from '@/lib/room-helpers'

export default function InterviewRoomPage() {
  const { id } = useParams<{ id: string }>()
  const roomId = id ?? ''

  const { user, isLoaded, isSignedIn } = useAuthProfileReady({ requireUser: true })
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()

  // Room Record from RecordRoom
  const { records, status: queryStatus } = useQuery<RoomRecord>('rooms', {
    where: { recordId: roomId },
  })
  const { put: updateRoom } = useMutations<RoomRecord>('rooms')

  const roomRecord = records?.[0]
  const room = roomRecord?.data

  const currentUserId = user?.id ?? ''
  const isInterviewer = room?.interviewerId === currentUserId
  const isCandidate = room?.candidateId === currentUserId

  // Yjs real-time collaborative text sync for code
  const {
    text: yjsCode,
    setText: setYjsCode,
    synced: yjsSynced,
    canWrite: yjsCanWrite,
  } = useYjsText('rooms', roomId, 'code')

  // Presence WebSocket connection
  const { peers, connected: presenceConnected, updateState } = usePresenceRoom(`room:${roomId}`)

  // Code editor state
  const [copiedInvite, setCopiedInvite] = useState(false)
  const [problemExpanded, setProblemExpanded] = useState(true)
  const [isEditingProblem, setIsEditingProblem] = useState(false)
  const [problemDraft, setProblemDraft] = useState('')
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorCol, setCursorCol] = useState(1)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Determine current code: Yjs is authoritative when synced; fallback to room.code
  const currentCode = yjsSynced ? yjsCode : room?.code || ''
  const isCompleted = room?.status === 'completed'
  // Candidate cannot write when completed; interviewer can always review
  const canEditCode = !isCompleted || isInterviewer

  // Initialize problem draft
  useEffect(() => {
    if (room?.problemStatement && !isEditingProblem) {
      setProblemDraft(room.problemStatement)
    }
  }, [room?.problemStatement, isEditingProblem])

  // Sync initial starter code to Yjs if room is fresh and Yjs is empty
  useEffect(() => {
    if (yjsSynced && !yjsCode && room?.code && isInterviewer) {
      setYjsCode(room.code)
    }
  }, [yjsSynced, yjsCode, room?.code, isInterviewer])

  // Broadcast presence on cursor movement or load
  useEffect(() => {
    if (!presenceConnected) return
    const userName =
      user?.name || user?.email || (isInterviewer ? 'Interviewer' : 'Candidate')
    updateState({
      line: cursorLine,
      col: cursorCol,
      userName,
      role: isInterviewer ? 'interviewer' : 'candidate',
    })
  }, [presenceConnected, cursorLine, cursorCol, user, isInterviewer])

  // Calculate line numbers
  const lineCount = useMemo(() => {
    return Math.max(1, currentCode.split('\n').length)
  }, [currentCode])

  // Handle textarea scroll sync with line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  // Handle cursor position changes
  const handleSelectOrKeyUp = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    const value = textarea.value
    const selectionStart = textarea.selectionStart

    const textBeforeCursor = value.substring(0, selectionStart)
    const lines = textBeforeCursor.split('\n')
    const currentLineNumber = lines.length
    const currentColNumber = lines[lines.length - 1].length + 1

    setCursorLine(currentLineNumber)
    setCursorCol(currentColNumber)
  }

  // Handle code change
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!canEditCode) return
    const val = e.target.value
    if (yjsSynced) {
      setYjsCode(val)
    }
    handleSelectOrKeyUp(e)
  }

  // Handle Tab key indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (!canEditCode) return

      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const val = textarea.value

      const updated = val.substring(0, start) + '  ' + val.substring(end)
      if (yjsSynced) {
        setYjsCode(updated)
      }

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  // Language switch
  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    if (!isInterviewer) return
    try {
      await updateRoom(roomId, { language: newLang })
      toastSuccess('Language Updated', `Switched workspace to ${newLang}.`)
    } catch (err: unknown) {
      toastError('Update failed', err instanceof Error ? err.message : 'Could not change language')
    }
  }

  // Save Problem Statement
  const handleSaveProblem = async () => {
    if (!isInterviewer) return
    try {
      await updateRoom(roomId, { problemStatement: problemDraft.trim() })
      setIsEditingProblem(false)
      toastSuccess('Problem Saved', 'Updated problem prompt for candidate.')
    } catch (err: unknown) {
      toastError('Failed to save problem', err instanceof Error ? err.message : 'Error')
    }
  }

  // Complete Interview
  const handleCompleteInterview = async () => {
    if (!isInterviewer) return
    if (!confirm('Are you sure you want to complete this interview? This will lock the candidate editor to read-only.')) {
      return
    }

    try {
      await updateRoom(roomId, { status: 'completed' })
      toastSuccess('Interview Completed', 'Candidate editor is now locked to read-only.')
    } catch (err: unknown) {
      toastError('Failed to complete interview', err instanceof Error ? err.message : 'Error')
    }
  }

  const copyInviteLink = () => {
    if (!room?.inviteCode) return
    const inviteUrl = `${window.location.origin}/join/${room.inviteCode}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedInvite(true)
    toastSuccess('Invite Link Copied', inviteUrl)
    setTimeout(() => setCopiedInvite(false), 2500)
  }

  if (!isLoaded || queryStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <h2 className="text-xl font-bold text-foreground">Interview Room Not Found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This room may have been deleted or you do not have permission to access it.
        </p>
        <Link to="/home" className="mt-4">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background text-foreground overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/home" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 truncate">
            <Code2 className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-sm font-semibold truncate text-foreground">{room.title}</h1>
          </div>

          <StatusBadge status={room.status} />

          {/* Role badge */}
          <Badge
            variant="outline"
            className={
              isInterviewer
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs'
            }
          >
            {isInterviewer ? 'Interviewer' : 'Candidate'}
          </Badge>
        </div>

        {/* Presence & Actions */}
        <div className="flex items-center gap-3">
          {/* Live presence chips */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50">
              <span
                className={`h-2 w-2 rounded-full ${
                  presenceConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span>
                {peers.length + 1} present
              </span>
            </div>

            {peers.map((peer) => {
              const peerRole = String(peer.state?.role ?? 'Participant')
              const peerLine = peer.state?.line ? ` (L${peer.state.line})` : ''
              return (
                <span
                  key={peer.userId}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  title={`${peer.userName} (${peerRole})`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-medium truncate max-w-[100px]">
                    {peer.userName || peerRole}
                  </span>
                  <span className="text-muted-foreground text-[10px]">{peerLine}</span>
                </span>
              )
            })}
          </div>

          {/* Copy invite button */}
          <Button
            variant="outline"
            size="sm"
            onClick={copyInviteLink}
            className="h-8 gap-1.5 text-xs"
          >
            {copiedInvite ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Invite Candidate</span>
              </>
            )}
          </Button>

          {/* Complete Interview button for interviewer */}
          {isInterviewer && room.status !== 'completed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompleteInterview}
              className="h-8 gap-1 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete Session
            </Button>
          )}
        </div>
      </div>

      {/* Completed Read-only Banner for Candidate */}
      {isCompleted && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 text-xs text-blue-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            <span>
              This technical interview is marked as <strong>Completed</strong>. The code editor is locked in read-only mode for candidate review.
            </span>
          </div>
          {isInterviewer && (
            <span className="text-[11px] text-blue-300 font-medium">
              Interviewer Access: Reviewing & Finalizing Scorecard
            </span>
          )}
        </div>
      )}

      {/* Main Split-Screen Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Main Workspace: Code Editor & Problem Header */}
        <div
          className={`flex flex-col flex-1 min-w-0 border-r border-border bg-[#0d1117] transition-all duration-200`}
        >
          {/* Problem Statement Header */}
          <div className="border-b border-border/80 bg-[#161b22] px-4 py-2.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setProblemExpanded(!problemExpanded)}
                className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition"
              >
                {problemExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Problem Prompt</span>
              </button>

              <div className="flex items-center gap-2">
                {isInterviewer && !isCompleted && (
                  <button
                    onClick={() => {
                      if (isEditingProblem) handleSaveProblem()
                      else setIsEditingProblem(true)
                    }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {isEditingProblem ? 'Save Prompt' : 'Edit Prompt'}
                  </button>
                )}
              </div>
            </div>

            {problemExpanded && (
              <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {isEditingProblem ? (
                  <div className="space-y-2 mt-1">
                    <Textarea
                      rows={3}
                      value={problemDraft}
                      onChange={(e) => setProblemDraft(e.target.value)}
                      placeholder="Enter problem requirements, edge cases, and constraints..."
                      className="text-xs font-mono bg-[#0d1117] border-border"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setProblemDraft(room.problemStatement || '')
                          setIsEditingProblem(false)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleSaveProblem}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap font-sans">
                    {room.problemStatement ||
                      'No problem prompt specified. The interviewer will guide the session.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Code Editor Toolbar */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 bg-[#161b22] px-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Language:</span>
              {isInterviewer && !isCompleted ? (
                <select
                  value={room.language}
                  onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                  className="rounded border border-border bg-[#0d1117] px-2 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                </select>
              ) : (
                <span className="text-xs font-mono font-medium text-foreground uppercase">
                  {room.language}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {yjsSynced ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Synced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Connecting...
                </span>
              )}
              <span className="font-mono text-[11px]">
                Ln {cursorLine}, Col {cursorCol}
              </span>
            </div>
          </div>

          {/* Collaborative Code Editor Body */}
          <div className="relative flex-1 flex overflow-hidden font-mono text-sm">
            {/* Line Numbers */}
            <div
              ref={lineNumbersRef}
              className="w-12 shrink-0 select-none overflow-hidden bg-[#161b22]/50 py-3 text-right pr-3 text-xs font-mono text-muted-foreground/40 leading-6 border-r border-border/30"
            >
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i} className={cursorLine === i + 1 ? 'text-foreground/80 font-bold' : ''}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Input Textarea */}
            <textarea
              ref={textareaRef}
              value={currentCode}
              onChange={handleCodeChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelectOrKeyUp}
              onKeyUp={handleSelectOrKeyUp}
              onClick={handleSelectOrKeyUp}
              onScroll={handleScroll}
              disabled={!canEditCode}
              placeholder="// Write code here collaboratively..."
              spellCheck={false}
              className={`flex-1 resize-none bg-transparent p-3 text-sm text-[#e6edf3] font-mono leading-6 outline-none focus:outline-none whitespace-pre overflow-auto ${
                !canEditCode ? 'cursor-not-allowed opacity-80' : ''
              }`}
            />
          </div>
        </div>

        {/* Right Pane: Role-Gated (Interviewer ONLY) */}
        {isInterviewer && (
          <div className="w-[420px] shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
            <InterviewRightPanel roomId={roomId} room={room} currentCode={currentCode} />
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: RoomRecord['status'] }) {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </Badge>
    )
  }
  if (status === 'completed') {
    return (
      <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 gap-1 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        Completed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 gap-1 text-xs">
      <Clock className="h-3 w-3" />
      Waiting
    </Badge>
  )
}

/** Right Panel container for Phase 2/3 */
function InterviewRightPanel({
  roomId,
  room,
  currentCode,
}: {
  roomId: string
  room: RoomRecord
  currentCode: string
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Interviewer Workspace (Private)
          </h2>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto text-xs text-muted-foreground">
        <p>Interviewer panel ready for Phase 3: Private Notes & Rubric, R2 Attachments, and AI Copilot.</p>
      </div>
    </div>
  )
}
