import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthProfileReady, useQuery, useMutations } from 'deepspace'
import {
  Code2,
  Plus,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  Users,
  ChevronRight,
} from 'lucide-react'
import { Button, Input, Textarea, Badge, useToast } from '@/components/ui'
import type { RoomRecord } from '@/schemas/rooms-schema'
import { LANGUAGE_STARTERS, generateInviteCode, type SupportedLanguage } from '@/lib/room-helpers'

export default function HomePage() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useToast()

  const { records: roomRecords, status: queryStatus } = useQuery<RoomRecord>('rooms', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 100,
  })

  const { createConfirmed } = useMutations<RoomRecord>('rooms')

  // Room Creation Modal / State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<SupportedLanguage>('typescript')
  const [problemStatement, setProblemStatement] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Filter rooms by interviewer vs candidate
  const currentUserId = user?.id ?? ''
  const interviewerRooms = (roomRecords ?? []).filter((r) => r.data.interviewerId === currentUserId)
  const candidateRooms = (roomRecords ?? []).filter(
    (r) => r.data.candidateId === currentUserId && r.data.interviewerId !== currentUserId,
  )

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    try {
      setIsSubmitting(true)
      const inviteCode = generateInviteCode()
      const starterCode = LANGUAGE_STARTERS[language]

      const newRoom: RoomRecord = {
        title: title.trim(),
        language,
        problemStatement: problemStatement.trim(),
        status: 'waiting',
        code: starterCode,
        interviewerId: currentUserId,
        interviewerName: user?.name || user?.email || 'Interviewer',
        candidateId: '',
        candidateName: '',
        inviteCode,
        collaborators: JSON.stringify([currentUserId]),
      }

      const newId = await createConfirmed(newRoom)
      toastSuccess('Interview Room Created', `Room "${title}" is ready.`)
      setShowCreateModal(false)
      setTitle('')
      setProblemStatement('')
      navigate(`/room/${newId}`)
    } catch (err: unknown) {
      toastError(
        'Failed to create room',
        err instanceof Error ? err.message : 'Unknown error occurred',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyInviteLink = (code: string) => {
    const inviteUrl = `${window.location.origin}/join/${code}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedCode(code)
    toastSuccess('Invite Link Copied', inviteUrl)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Code2 className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Interview Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your technical interviews, live code sessions, and candidate scorecards.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create Interview Room
        </Button>
      </div>

      {/* Main Content */}
      <div className="mt-8 grid gap-8">
        {/* Interviewer Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">My Interviews (as Interviewer)</h2>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                {interviewerRooms.length}
              </Badge>
            </div>
          </div>

          {interviewerRooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
              <Code2 className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <h3 className="mt-3 text-sm font-medium text-foreground">No interview rooms yet</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Create your first mock interview room and share the candidate invite link.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 inline-flex items-center gap-1.5"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                New Room
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {interviewerRooms.map((room) => (
                <div
                  key={room.recordId}
                  className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-border/90 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-1 text-xs font-medium text-secondary-foreground uppercase tracking-wider">
                        {room.data.language}
                      </span>
                      <StatusBadge status={room.data.status} />
                    </div>

                    <h3 className="mt-3 font-semibold text-foreground line-clamp-1">
                      {room.data.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {room.data.problemStatement || 'No problem prompt set.'}
                    </p>

                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>Candidate: {room.data.candidateName || 'Waiting to join'}</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(room.data.inviteCode)}
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copiedCode === room.data.inviteCode ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Invite Link</span>
                        </>
                      )}
                    </Button>

                    <Link to={`/room/${room.recordId}`}>
                      <Button size="sm" className="h-8 gap-1.5 text-xs">
                        Enter
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Candidate Section */}
        <div className="border-t border-border/60 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Joined Interviews (as Candidate)</h2>
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                {candidateRooms.length}
              </Badge>
            </div>
          </div>

          {candidateRooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center">
              <p className="text-xs text-muted-foreground">
                You haven't joined any interview rooms as a candidate yet. Use an invite link from an interviewer to enter.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {candidateRooms.map((room) => (
                <div
                  key={room.recordId}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-1 text-xs font-medium text-secondary-foreground uppercase tracking-wider">
                        {room.data.language}
                      </span>
                      <StatusBadge status={room.data.status} />
                    </div>

                    <h3 className="mt-3 font-semibold text-foreground line-clamp-1">
                      {room.data.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Interviewer: {room.data.interviewerName || 'Assigned Interviewer'}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-end border-t border-border/50 pt-4">
                    <Link to={`/room/${room.recordId}`}>
                      <Button size="sm" className="h-8 gap-1.5 text-xs">
                        Open Workspace
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">New Interview Room</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Interview Title *
                </label>
                <Input
                  required
                  placeholder="e.g. Senior Frontend Engineer — Live Coding"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Primary Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Problem Prompt (Optional)
                </label>
                <Textarea
                  rows={4}
                  placeholder="Describe the coding challenge, constraints, or input/output examples..."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !title.trim()}>
                  {isSubmitting ? 'Creating...' : 'Create Room'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: RoomRecord['status'] }) {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 gap-1 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Active
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
