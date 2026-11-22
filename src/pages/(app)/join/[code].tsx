import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthProfileReady, AuthOverlay, getAuthToken } from 'deepspace'
import { Code2, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { JoinRoomResult } from '@/actions/join-room'

export default function JoinRoomPage() {
  const { code } = useParams<{ code: string }>()
  const { isSignedIn, isLoaded, user } = useAuthProfileReady({ requireUser: false })
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleJoin = async () => {
    if (!code) return
    try {
      setLoading(true)
      setError(null)

      const token = await getAuthToken()
      // Fallback: fetch directly from action endpoint
      const response = await fetch('/api/actions/joinRoom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          inviteCode: code,
          userName: user?.name || user?.email || 'Candidate',
        }),
      })

      const data = await response.json() as { success: boolean; data?: JoinRoomResult; error?: string }

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || 'Failed to join interview room')
      }

      navigate(`/room/${data.data.roomId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error joining room')
    } finally {
      setLoading(false)
    }
  }

  // Auto-trigger join if user is already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn && user && code && !loading && !error) {
      handleJoin()
    }
  }, [isLoaded, isSignedIn, user, code])

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Code2 className="h-7 w-7" />
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
          Join Technical Interview
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You've been invited to a live collaborative coding session with code{' '}
          <span className="font-mono font-medium text-foreground">{code}</span>.
        </p>

        {error ? (
          <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-left">
            <div className="flex gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Unable to Join</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={handleJoin} className="w-full">
                Retry
              </Button>
              <Link to="/home" className="w-full">
                <Button size="sm" variant="ghost" className="w-full">
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        ) : !isSignedIn ? (
          <div className="mt-6 space-y-3">
            <p className="text-xs text-muted-foreground">
              Sign in with your account or as a candidate to enter the live workspace.
            </p>
            <Button
              className="w-full gap-2 shadow-sm"
              onClick={() => setShowAuthModal(true)}
            >
              Sign In to Enter
              <ArrowRight className="h-4 w-4" />
            </Button>
            {showAuthModal && <AuthOverlay onClose={() => setShowAuthModal(false)} />}
          </div>
        ) : (
          <div className="mt-6">
            <Button disabled className="w-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Entering Interview Workspace...
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
