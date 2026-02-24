'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Clock3,
  Cpu,
  Gauge,
  PlayCircle,
  Sparkles,
  Zap,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Alert } from '@/lib/api-client'
import type { ExperimentRun, Sweep } from '@/lib/types'

interface ContextualOperationsPanelProps {
  runs: ExperimentRun[]
  sweeps: Sweep[]
  alerts: Alert[]
  onInsertPrompt: (prompt: string) => void
}

const NEW_RUN_DISMISS_MS = 30_000

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / (60 * 1000))
  const hours = Math.floor(diffMs / (60 * 60 * 1000))

  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function getRunStatusColor(status: ExperimentRun['status']) {
  switch (status) {
    case 'running': return 'bg-blue-500 animate-pulse'
    case 'completed': return 'bg-emerald-500'
    case 'failed': return 'bg-destructive'
    case 'queued': return 'bg-muted-foreground/80'
    case 'ready': return 'bg-muted-foreground/80'
    case 'canceled': return 'bg-muted-foreground'
    default: return 'bg-muted-foreground'
  }
}

export function ContextualOperationsPanel({
  runs,
  sweeps,
  alerts,
  onInsertPrompt,
}: ContextualOperationsPanelProps) {
  // ── Track new runs ──
  const seenRunIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const [newRunIds, setNewRunIds] = useState<string[]>([])

  useEffect(() => {
    const currentIds = new Set(runs.map((r) => r.id))

    if (!initializedRef.current) {
      // First render: seed the set without showing anything as "new"
      seenRunIdsRef.current = currentIds
      initializedRef.current = true
      return
    }

    const freshIds: string[] = []
    currentIds.forEach((id) => {
      if (!seenRunIdsRef.current.has(id)) {
        freshIds.push(id)
      }
    })

    if (freshIds.length > 0) {
      seenRunIdsRef.current = new Set([...seenRunIdsRef.current, ...freshIds])
      setNewRunIds((prev) => [...new Set([...prev, ...freshIds])])
    }
  }, [runs])

  // Auto-dismiss new run indicators after timeout
  useEffect(() => {
    if (newRunIds.length === 0) return
    const timer = setTimeout(() => setNewRunIds([]), NEW_RUN_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [newRunIds])

  const dismissNewRun = useCallback((id: string) => {
    setNewRunIds((prev) => prev.filter((rid) => rid !== id))
  }, [])

  const newRuns = useMemo(
    () => runs.filter((run) => newRunIds.includes(run.id)),
    [runs, newRunIds]
  )

  const runningRuns = useMemo(
    () => runs.filter((run) => run.status === 'running'),
    [runs]
  )

  const queuedRuns = useMemo(
    () => runs.filter((run) => run.status === 'queued' || run.status === 'ready'),
    [runs]
  )

  const pendingAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === 'pending').slice(0, 5),
    [alerts]
  )

  const activeSweeps = useMemo(
    () => sweeps.filter((sweep) => sweep.status === 'running' || sweep.status === 'pending').slice(0, 5),
    [sweeps]
  )

  const totalSlots = Math.max(8, runningRuns.length + queuedRuns.length)
  const utilization = Math.min(100, Math.round((runningRuns.length / Math.max(totalSlots, 1)) * 100))

  return (
    <div className="h-full overflow-y-auto px-2 py-2">
      <div className="space-y-2">
        {newRuns.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="px-3 py-2 pb-1.5">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-primary" />
                  New Runs
                </span>
                <Badge variant="outline" className="text-[10px] border-primary/30">
                  {newRuns.length} new
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="flex flex-wrap gap-1.5">
                {newRuns.map((run) => (
                  <Tooltip key={run.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onInsertPrompt(`@run:${run.id} this run just appeared — check its status and config.`)}
                        className="group inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-secondary/60 hover:border-primary/40"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${getRunStatusColor(run.status)}`} />
                        <span className="max-w-[100px] truncate">{run.alias || run.name || run.id}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            dismissNewRun(run.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              dismissNewRun(run.id)
                            }
                          }}
                          className="ml-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                        >
                          <X className="h-2.5 w-2.5" />
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{run.alias || run.name} — {run.status}</p>
                      <p className="text-[10px] text-muted-foreground">Click to review in chat</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/80 bg-card/95">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-primary" />
                Cluster Pulse
              </span>
              <Badge variant="outline" className="text-[10px]">
                {runningRuns.length}/{totalSlots} busy
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-3 pb-3 pt-0 text-xs">
            <div>
              <div className="mb-0.5 flex items-center justify-between text-muted-foreground">
                <span>Utilization</span>
                <span>{utilization}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${utilization}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-md border border-border/70 bg-background/70 p-1.5">
                <p className="text-[10px] text-muted-foreground">Running</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{runningRuns.length}</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/70 p-1.5">
                <p className="text-[10px] text-muted-foreground">Queued</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{queuedRuns.length}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() =>
                onInsertPrompt(
                  `Given ${runningRuns.length} running jobs and ${queuedRuns.length} queued jobs, propose a queue rebalance and scheduling strategy for highest learning-per-hour.`
                )
              }
            >
              <Gauge className="h-3.5 w-3.5" />
              Rebalance Scheduler
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              Job Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3 pb-3 pt-0">
            {queuedRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground">No queued jobs right now.</p>
            ) : (
              queuedRuns.slice(0, 6).map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => onInsertPrompt(`@run:${run.id} evaluate if this queued job should run now or be reordered.`)}
                  className="w-full rounded-md border border-border/70 bg-background/70 px-2 py-1.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <p className="truncate text-xs font-medium text-foreground">{run.alias || run.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {run.status} · queued {formatRelativeTime(run.startTime)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3 pb-3 pt-0">
            {pendingAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending alerts.</p>
            ) : (
              pendingAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onInsertPrompt(`@alert:${alert.id} diagnose this issue and choose the safest allowed response.`)}
                  className="w-full rounded-md border border-border/70 bg-background/70 px-2 py-1.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <p className="line-clamp-2 text-xs font-medium text-foreground">{alert.message}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="h-4 px-1.5 text-[9px] uppercase"
                    >
                      {alert.severity}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Run {alert.run_id}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Sweeps In Flight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3 pb-3 pt-0">
            {activeSweeps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No active sweeps.</p>
            ) : (
              activeSweeps.map((sweep) => (
                <button
                  key={sweep.id}
                  type="button"
                  onClick={() => onInsertPrompt(`@sweep:${sweep.id} summarize progress, bottlenecks, and next trials.`)}
                  className="w-full rounded-md border border-border/70 bg-background/70 px-2 py-1.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <p className="truncate text-xs font-medium text-foreground">{sweep.config.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {sweep.progress.running} running · {sweep.progress.completed}/{sweep.progress.total} completed
                  </p>
                </button>
              ))
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => onInsertPrompt('Draft a new sweep from what we learned in the last 24 hours.')}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Plan Next Sweep
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
