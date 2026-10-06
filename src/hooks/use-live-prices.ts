"use client"

// Keeps the price section of PROJ-2 current in the browser (design.md → "Verhalten im Browser"):
// a clock that ticks at every 15-minute slot boundary (AC-19), a catch-up on return to the
// foreground (EC-7), conditional refetching of /api/prices (AC-20), the day change at midnight
// (AC-21), silent failure handling (EC-8) and the "Erneut versuchen" request (AC-23).
// PROJ-3 runs it once per page in LivePricesProvider: it starts without a payload and adopts the
// server-rendered one from the "Strompreise" section via `handover` (PROJ-3 design.md → LivePricesProvider).
import * as React from "react"

import { berlinToday, nextBerlinDate } from "@/lib/prices/berlin-time"
import type { PricesPayload } from "@/lib/prices/types"

const SLOT_MS = 15 * 60 * 1000

/**
 * Milliseconds until the start of the next 15-minute slot. Slot boundaries are multiples of
 * 15 minutes in absolute time (UTC and Berlin alike), so this is computed from epoch ms and never
 * from the device time zone. Exactly on a boundary it returns a full slot.
 */
export function msUntilNextSlot(nowMs: number): number {
  return SLOT_MS - (((nowMs % SLOT_MS) + SLOT_MS) % SLOT_MS)
}

/** Error state for `today` when nothing usable is left for that day (EC-8, AC-23). */
function errorPayload(today: string): PricesPayload {
  return {
    generatedAt: new Date().toISOString(),
    today: { date: today, status: "error" },
    tomorrow: { date: nextBerlinDate(today), status: "not_published" },
  }
}

type FetchResult =
  | { kind: "ok"; payload: PricesPayload }
  | { kind: "unauthorized" }
  | { kind: "failed" }

async function fetchPrices(signal: AbortSignal): Promise<FetchResult> {
  try {
    const res = await fetch("/api/prices", { cache: "no-store", signal })
    if (res.status === 401) return { kind: "unauthorized" }
    if (!res.ok) return { kind: "failed" }
    return { kind: "ok", payload: (await res.json()) as PricesPayload }
  } catch {
    return { kind: "failed" }
  }
}

export type LivePrices<P extends PricesPayload | null = PricesPayload | null> = {
  /** The current price payload; null until the first payload was handed over. */
  payload: P
  /** "Now", recomputed at every slot boundary and on return to the foreground. */
  now: Date
  /** "Erneut versuchen" (AC-23): always asks the server. */
  retry: () => Promise<void>
  retrying: boolean
  /** Adopts a payload while the hook has none yet. Only the first one counts, later calls are ignored. */
  handover: (payload: PricesPayload) => void
}

/**
 * Started with a payload, the hook keeps it current. Started with `null`, the clock ticks but nothing is
 * refetched (there is nothing to check) until `handover` delivers the first payload.
 */
export function useLivePrices(initial: PricesPayload): LivePrices<PricesPayload>
export function useLivePrices(initial: PricesPayload | null): LivePrices
export function useLivePrices(initial: PricesPayload | null): LivePrices {
  const [payload, setPayloadState] = React.useState<PricesPayload | null>(initial)
  const [now, setNow] = React.useState<Date>(() => new Date())
  const [retrying, setRetrying] = React.useState(false)

  // Refs so timer and event callbacks always see the latest values without re-subscribing.
  const payloadRef = React.useRef(payload)
  const inFlightRef = React.useRef<Promise<void> | null>(null)
  const mountedRef = React.useRef(false)
  const abortRef = React.useRef<AbortController | null>(null)

  const setPayload = React.useCallback((next: PricesPayload) => {
    payloadRef.current = next
    setPayloadState(next)
  }, [])

  // One request to /api/prices; a second caller while it runs shares the running request.
  const request = React.useCallback((): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current
    const controller = new AbortController()
    abortRef.current = controller

    const run = async () => {
      const result = await fetchPrices(controller.signal)
      if (!mountedRef.current) return

      if (result.kind === "unauthorized") {
        // Session expired or account deleted: PROJ-1's protection redirects to /login.
        window.location.reload()
        return
      }

      const today = berlinToday(new Date())
      const current = payloadRef.current

      if (result.kind === "ok") {
        const stillValid = current !== null && current.today.date === today && current.today.status === "ok"
        // EC-8: an error for today in the response never replaces data that still fits today.
        if (result.payload.today.status === "error" && stillValid) return
        setPayload(result.payload)
        return
      }

      // Network error or non-2xx (EC-8): keep the shown data while it belongs to today,
      // otherwise show the error state; the next attempt comes at the next slot boundary.
      // Without a payload yet, nothing is shown that could be replaced: stay empty for the handover.
      if (current !== null && current.today.date !== today) setPayload(errorPayload(today))
    }

    const promise = run().finally(() => {
      inFlightRef.current = null
      if (abortRef.current === controller) abortRef.current = null
    })
    inFlightRef.current = promise
    return promise
  }, [setPayload])

  // Refresh check (AC-20, AC-21), run at every slot boundary and on return to the foreground.
  const check = React.useCallback(
    (at: Date) => {
      const today = berlinToday(at)
      const current = payloadRef.current
      // No payload handed over yet: nothing to check, the clock alone moves on.
      if (current === null) return

      if (current.today.date !== today) {
        // Day change: promote tomorrow locally right away, then let the server replace it.
        if (current.tomorrow.status === "ok" && current.tomorrow.date === today) {
          setPayload({
            ...current,
            today: current.tomorrow,
            tomorrow: { date: nextBerlinDate(today), status: "not_published" },
          })
        }
        if (!inFlightRef.current) void request()
        return
      }

      // Same day: only ask while tomorrow's prices are still missing.
      if (current.tomorrow.status !== "ok" && !inFlightRef.current) void request()
    },
    [request, setPayload],
  )

  React.useEffect(() => {
    mountedRef.current = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(tick, msUntilNextSlot(Date.now()))
    }

    function tick() {
      const at = new Date()
      setNow(at)
      check(at)
      schedule()
    }

    // EC-7: timers may have been throttled or suspended while hidden or in standby.
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick()
    }

    schedule()
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onVisibility)

    return () => {
      mountedRef.current = false
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onVisibility)
      abortRef.current?.abort()
    }
  }, [check])

  // AC-23: "Erneut versuchen" always asks the server, with a loading state while it runs.
  const retry = React.useCallback(async () => {
    setRetrying(true)
    try {
      await request()
    } finally {
      if (mountedRef.current) setRetrying(false)
    }
  }, [request])

  // First payload wins (idempotent under StrictMode's double effects); after that the hook owns the state.
  const handover = React.useCallback(
    (next: PricesPayload) => {
      if (payloadRef.current !== null) return
      setPayload(next)
    },
    [setPayload],
  )

  return { payload, now, retry, retrying, handover }
}
