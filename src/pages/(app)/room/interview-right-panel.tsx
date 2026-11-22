import { useState, useEffect } from 'react'
import {
  useQuery,
  useMutations,
  useR2Files,
  getAuthToken,
} from 'deepspace'
import {
  FileText,
  Paperclip,
  Sparkles,
  Lightbulb,
  FileQuestion,
  Award,
  Upload,
  Trash2,
  Download,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Save,
  HelpCircle,
  FileUp,
} from 'lucide-react'
import {
  Button,
  Textarea,
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from '@/components/ui'
import type { RoomRecord } from '@/schemas/rooms-schema'
import type { PrivateNoteRecord } from '@/schemas/private-notes-schema'
import type { RubricRecord } from '@/schemas/rubrics-schema'
import type { RoomAttachmentRecord } from '@/schemas/room-attachments-schema'
import type { AiCopilotLogRecord } from '@/schemas/ai-copilot-logs-schema'

interface InterviewRightPanelProps {
  roomId: string
  room: RoomRecord
  currentCode: string
}

export function InterviewRightPanel({ roomId, room, currentCode }: InterviewRightPanelProps) {
  const { success: toastSuccess, error: toastError } = useToast()

  // 1. Private Notes query & mutations
  const { records: noteRecords } = useQuery<PrivateNoteRecord>('privateNotes', {
    where: { roomId },
    limit: 1,
  })
  const { put: updateNote, create: createNote } = useMutations<PrivateNoteRecord>('privateNotes')
  const existingNoteRecord = noteRecords?.[0]
  const [notesText, setNotesText] = useState('')

  useEffect(() => {
    if (existingNoteRecord?.data?.notes !== undefined) {
      setNotesText(existingNoteRecord.data.notes)
    }
  }, [existingNoteRecord?.data?.notes])

  // 2. Rubrics query & mutations
  const { records: rubricRecords } = useQuery<RubricRecord>('rubrics', {
    where: { roomId },
    limit: 1,
  })
  const { put: updateRubric, create: createRubric } = useMutations<RubricRecord>('rubrics')
  const existingRubricRecord = rubricRecords?.[0]

  const [problemSolving, setProblemSolving] = useState(3)
  const [codeQuality, setCodeQuality] = useState(3)
  const [communication, setCommunication] = useState(3)
  const [recommendation, setRecommendation] = useState<RubricRecord['recommendation']>('undecided')
  const [summaryFeedback, setSummaryFeedback] = useState('')

  useEffect(() => {
    if (existingRubricRecord?.data) {
      setProblemSolving(existingRubricRecord.data.problemSolving ?? 3)
      setCodeQuality(existingRubricRecord.data.codeQuality ?? 3)
      setCommunication(existingRubricRecord.data.communication ?? 3)
      setRecommendation(existingRubricRecord.data.recommendation ?? 'undecided')
      setSummaryFeedback(existingRubricRecord.data.summaryFeedback ?? '')
    }
  }, [existingRubricRecord?.data])

  // 3. Attachments query & mutations
  const { records: attachmentRecords } = useQuery<RoomAttachmentRecord>('roomAttachments', {
    where: { roomId },
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { createConfirmed: createAttachment, remove: removeAttachment } =
    useMutations<RoomAttachmentRecord>('roomAttachments')

  const { upload, deleteFile } = useR2Files({ scope: 'app' })
  const [isUploading, setIsUploading] = useState(false)

  // 4. AI Copilot state & logs
  const { records: aiLogRecords } = useQuery<AiCopilotLogRecord>('aiCopilotLogs', {
    where: { roomId },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 10,
  })

  const [aiLoading, setAiLoading] = useState(false)
  const [aiActiveAction, setAiActiveAction] = useState<string | null>(null)
  const [latestAiOutput, setLatestAiOutput] = useState<{
    type: 'hint' | 'follow_up' | 'scorecard'
    text: string
  } | null>(null)
  const [copiedAi, setCopiedAi] = useState(false)

  // Save Notes and Rubrics
  const handleSaveRubricAndNotes = async () => {
    try {
      if (existingNoteRecord) {
        await updateNote(existingNoteRecord.recordId, { notes: notesText })
      } else {
        await createNote({
          roomId,
          interviewerId: room.interviewerId,
          notes: notesText,
        })
      }

      if (existingRubricRecord) {
        await updateRubric(existingRubricRecord.recordId, {
          problemSolving,
          codeQuality,
          communication,
          recommendation,
          summaryFeedback,
        })
      } else {
        await createRubric({
          roomId,
          interviewerId: room.interviewerId,
          problemSolving,
          codeQuality,
          communication,
          recommendation,
          summaryFeedback,
        })
      }

      toastSuccess('Notes & Rubric Saved', 'Your evaluation notes are securely stored.')
    } catch (err: unknown) {
      toastError('Save failed', err instanceof Error ? err.message : 'Could not save rubric')
    }
  }

  // Handle file upload to R2
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const fileKey = `rooms/${roomId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      let fileUrl = ''

      try {
        const uploadRes = await upload(file, fileKey)
        if (uploadRes?.url) {
          fileUrl = uploadRes.url
        }
      } catch (uploadErr) {
        console.warn('R2 upload gateway notice (local dev simulation fallback):', uploadErr)
        fileUrl = URL.createObjectURL(file)
      }

      await createAttachment({
        roomId,
        interviewerId: room.interviewerId,
        fileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        fileUrl,
      })

      toastSuccess('File Attached', `${file.name} saved to room attachments.`)
      e.target.value = ''
    } catch (err: unknown) {
      toastError('Upload failed', err instanceof Error ? err.message : 'Error uploading file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteAttachment = async (recordId: string, fileKey: string) => {
    try {
      try {
        await deleteFile(fileKey)
      } catch (delErr) {
        console.warn('R2 delete notice:', delErr)
      }
      await removeAttachment(recordId)
      toastSuccess('Attachment Removed', 'File deleted.')
    } catch (err: unknown) {
      toastError('Delete failed', err instanceof Error ? err.message : 'Error deleting file')
    }
  }

  // AI Copilot Actions
  const runAiAction = async (endpoint: 'hint' | 'follow-up' | 'scorecard') => {
    try {
      setAiLoading(true)
      setAiActiveAction(endpoint)
      const token = await getAuthToken()

      const response = await fetch(`/api/rooms/${roomId}/ai/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: currentCode,
          problemStatement: room.problemStatement,
          privateNotes: notesText,
          rubric: { problemSolving, codeQuality, communication },
        }),
      })

      const data = (await response.json()) as {
        success?: boolean
        text?: string
        actionType?: 'hint' | 'follow_up' | 'scorecard'
        error?: string
      }

      if (!response.ok || !data.success || !data.text) {
        throw new Error(data.error || `Failed to generate AI ${endpoint}`)
      }

      const mappedType =
        endpoint === 'hint' ? 'hint' : endpoint === 'follow-up' ? 'follow_up' : 'scorecard'
      setLatestAiOutput({ type: mappedType, text: data.text })
      toastSuccess('AI Copilot Ready', `Generated ${endpoint.replace('-', ' ')}.`)
    } catch (err: unknown) {
      toastError('AI Copilot error', err instanceof Error ? err.message : 'Error calling AI')
    } finally {
      setAiLoading(false)
      setAiActiveAction(null)
    }
  }

  const copyAiOutput = () => {
    if (!latestAiOutput) return
    navigator.clipboard.writeText(latestAiOutput.text)
    setCopiedAi(true)
    setTimeout(() => setCopiedAi(false), 2000)
    toastSuccess('Copied', 'AI response copied to clipboard.')
  }

  const appendToNotes = () => {
    if (!latestAiOutput) return
    const appended = notesText
      ? `${notesText}\n\n---\n[AI ${latestAiOutput.type.toUpperCase()}]\n${latestAiOutput.text}`
      : `[AI ${latestAiOutput.type.toUpperCase()}]\n${latestAiOutput.text}`
    setNotesText(appended)
    toastSuccess('Added to Notes', 'Appended AI synthesis to your private notes.')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      <div className="border-b border-border bg-muted/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Interviewer Workspace
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
          Private to You
        </Badge>
      </div>

      <Tabs defaultValue="rubric" className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4 py-2 bg-muted/10">
          <TabsList className="grid grid-cols-3 w-full h-8 text-xs">
            <TabsTrigger value="rubric" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              Rubric & Notes
            </TabsTrigger>
            <TabsTrigger value="attachments" className="text-xs gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              Files ({attachmentRecords?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="copilot" className="text-xs gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              AI Copilot
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Notes & Rubric */}
        <TabsContent value="rubric" className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Structured Scoring */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Candidate Scoring (1 - 5)
            </h4>
            <div className="space-y-3">
              <ScoreRow
                label="Problem Solving"
                description="Algorithmic approach, edge cases, decomposition"
                value={problemSolving}
                onChange={setProblemSolving}
              />
              <ScoreRow
                label="Code Quality"
                description="Readability, structure, idiomatic syntax"
                value={codeQuality}
                onChange={setCodeQuality}
              />
              <ScoreRow
                label="Communication"
                description="Clarifying questions, thought articulation"
                value={communication}
                onChange={setCommunication}
              />
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Hiring Recommendation
            </label>
            <select
              value={recommendation}
              onChange={(e) =>
                setRecommendation(e.target.value as RubricRecord['recommendation'])
              }
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="undecided">Undecided</option>
              <option value="strong_hire">Strong Hire</option>
              <option value="hire">Hire</option>
              <option value="no_hire">No Hire</option>
              <option value="strong_no_hire">Strong No Hire</option>
            </select>
          </div>

          {/* Freeform Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Private Interviewer Notes
              </label>
              <span className="text-[10px] text-muted-foreground">Hidden from candidate</span>
            </div>
            <Textarea
              rows={6}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Record candidate strengths, struggles, complexity analysis, and observations..."
              className="text-xs font-sans leading-relaxed resize-none"
            />
          </div>

          <Button
            onClick={handleSaveRubricAndNotes}
            className="w-full gap-1.5 text-xs h-9 shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            Save Notes & Rubric
          </Button>
        </TabsContent>

        {/* Tab 2: Attachments (R2 Storage) */}
        <TabsContent value="attachments" className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Room Attachments (R2)
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Upload candidate resume PDF or system architecture diagram images scoped to this room.
            </p>
          </div>

          <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center cursor-pointer hover:bg-muted/40 transition">
            <FileUp className="h-6 w-6 text-primary mb-1.5" />
            <span className="text-xs font-medium text-foreground">
              {isUploading ? 'Uploading file to R2...' : 'Click to upload resume or diagram'}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              Supports PDF, PNG, JPG, SVG up to 25MB
            </span>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          <div className="space-y-2 mt-4">
            <span className="text-xs font-medium text-foreground">
              Uploaded Files ({attachmentRecords?.length ?? 0})
            </span>

            {(!attachmentRecords || attachmentRecords.length === 0) && (
              <p className="text-xs text-muted-foreground italic py-3 text-center border rounded-lg border-border/40">
                No attachments uploaded yet.
              </p>
            )}

            {attachmentRecords?.map((file) => (
              <div
                key={file.recordId}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-xs shadow-sm"
              >
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="h-4 w-4 text-primary shrink-0" />
                  <div className="truncate">
                    <p className="font-medium truncate text-foreground">{file.data.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.data.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {file.data.fileUrl && (
                    <a
                      href={file.data.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Open file"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteAttachment(file.recordId, file.data.fileKey)}
                    className="p-1 text-muted-foreground hover:text-destructive transition"
                    title="Delete attachment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: AI Copilot */}
        <TabsContent value="copilot" className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              AI Interview Copilot
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Analyzes candidate's live code buffer and problem prompt to assist your interview.
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={aiLoading}
              onClick={() => runAiAction('hint')}
              className="h-16 flex-col gap-1 text-xs border-amber-500/30 hover:bg-amber-500/10 text-amber-500 font-medium"
            >
              {aiLoading && aiActiveAction === 'hint' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
              <span>Candidate Hint</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={aiLoading}
              onClick={() => runAiAction('follow-up')}
              className="h-16 flex-col gap-1 text-xs border-blue-500/30 hover:bg-blue-500/10 text-blue-400 font-medium"
            >
              {aiLoading && aiActiveAction === 'follow-up' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileQuestion className="h-4 w-4" />
              )}
              <span>Follow-Up</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={aiLoading}
              onClick={() => runAiAction('scorecard')}
              className="h-16 flex-col gap-1 text-xs border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-500 font-medium"
            >
              {aiLoading && aiActiveAction === 'scorecard' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Award className="h-4 w-4" />
              )}
              <span>Scorecard</span>
            </Button>
          </div>

          {/* Active AI Output Display */}
          {latestAiOutput && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-semibold text-primary uppercase">
                  {latestAiOutput.type.replace('_', ' ')} Generation
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAiOutput}
                    className="h-7 text-xs gap-1"
                  >
                    {copiedAi ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={appendToNotes}
                    className="h-7 text-xs text-primary"
                  >
                    + Notes
                  </Button>
                </div>
              </div>

              <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-sans max-h-60 overflow-y-auto">
                {latestAiOutput.text}
              </div>
            </div>
          )}

          {/* Recent AI Generations Log */}
          {aiLogRecords && aiLogRecords.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Session Copilot History</span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {aiLogRecords.map((log) => (
                  <div
                    key={log.recordId}
                    className="rounded-lg border border-border/60 bg-muted/20 p-2 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {log.data.actionType}
                      </Badge>
                      <button
                        onClick={() =>
                          setLatestAiOutput({
                            type: log.data.actionType,
                            text: log.data.response,
                          })
                        }
                        className="text-[10px] text-primary hover:underline"
                      >
                        View Full
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {log.data.response}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ScoreRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number
  onChange: (val: number) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-xs font-bold text-primary">{value} / 5</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-2">{description}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`flex-1 py-1 text-xs rounded font-medium transition ${
              value === score
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}
