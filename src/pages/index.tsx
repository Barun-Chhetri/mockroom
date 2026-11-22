import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'
import { Code2, Sparkles, ShieldCheck, Users, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div className="relative min-h-screen bg-background text-foreground flex flex-col justify-between">
        {/* Navigation bar */}
        <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-sm">
              <Code2 className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">MockRoom</span>
          </div>
          <Link
            to="/home"
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1 text-xs font-medium text-muted-foreground mb-6 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Built on DeepSpace Real-Time Edge Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Live Technical Interviews, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-teal-400">
              Structured & Supercharged.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            MockRoom is the production-ready technical interviewing workspace. Real-time collaborative code editor with multiplayer presence, strict platform-enforced role permissions, private interviewer scorecards, and an AI copilot.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            <Link
              to="/home"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95 transition"
            >
              Start an Interview Room
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Feature Grid */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full">
            <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Code2 className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground text-sm">Real-Time Code Sync</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Multiplayer code editor with live syntax highlighting, language switching (TS, JS, Python, Java), and live cursor presence.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 mb-3">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground text-sm">Role-Gated Security</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Private notes and structured rubrics are strictly isolated in SQLite Durable Objects — unreadable by candidates at the platform data layer.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 mb-3">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground text-sm">AI Interview Copilot</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Generate subtle candidate hints, complexity follow-up questions, and synthesized hire/no-hire scorecards on demand.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 py-6 px-6 text-center text-xs text-muted-foreground">
          MockRoom &copy; 2026. Built with DeepSpace SDK on Cloudflare Workers.
        </footer>
      </div>
    </>
  )
}
