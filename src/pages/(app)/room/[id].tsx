import { useParams } from 'react-router-dom'
import { useAuthProfileReady, useQuery } from 'deepspace'
import type { RoomRecord } from '@/schemas/rooms-schema'
import { Loader2 } from 'lucide-react'

export default function RoomPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isLoaded } = useAuthProfileReady({ requireUser: true })

  const { records, status } = useQuery<RoomRecord>('rooms', {
    where: { recordId: id },
  })

  const room = records?.[0]
  const currentUserId = user?.id ?? ''
  const isInterviewer = room?.data.interviewerId === currentUserId
  const isCandidate = room?.data.candidateId === currentUserId

  if (!isLoaded || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">{room?.data.title || 'Interview Room'}</h1>
      <p className="text-sm text-muted-foreground">
        Role: {isInterviewer ? 'Interviewer' : isCandidate ? 'Candidate' : 'Participant'}
      </p>
    </div>
  )
}
