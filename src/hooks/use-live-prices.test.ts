import { act, renderHook } from "@testing-library/react"

import type { DayPrices, PricesPayload } from "@/lib/prices/types"

import { msUntilNextSlot, useLivePrices } from "./use-live-prices"

// Berlin is UTC+2 in early October 2026 (MESZ):
// 2026-10-06T21:59:00Z = 23:59 Berlin on the 6th, 2026-10-06T22:00:00Z = midnight → the 7th.
const MIN = 60 * 1000

function okDay(date: string, price = 100): DayPrices {
  return { date, status: "ok", slots: [{ start: `${date}T00:00:00.000Z`, priceEurMwh: price }] }
}

function payload(today: DayPrices, tomorrow: DayPrices, generatedAt = "2026-10-06T10:00:00.000Z"): PricesPayload {
  return { generatedAt, today, tomorrow }
}

const BOTH_OK = payload(okDay("2026-10-06"), okDay("2026-10-07"))
const TOMORROW_MISSING = payload(okDay("2026-10-06"), { date: "2026-10-07", status: "not_published" })

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

const fetchMock = vi.fn<typeof fetch>()

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  setVisibility("visible")
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("msUntilNextSlot", () => {
  it("counts to the next :00/:15/:30/:45 from epoch ms, a full slot exactly on a boundary", () => {
    expect(msUntilNextSlot(Date.parse("2026-10-06T10:07:30Z"))).toBe(7.5 * MIN)
    expect(msUntilNextSlot(Date.parse("2026-10-06T10:15:00Z"))).toBe(15 * MIN)
    expect(msUntilNextSlot(Date.parse("2026-10-06T21:59:00Z"))).toBe(1 * MIN)
  })
})

describe("useLivePrices", () => {
  it("does not fetch on mount and starts with the server payload", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))
    await advance(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.payload).toBe(TOMORROW_MISSING)
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:07:30.000Z")
  })

  it("updates now exactly at the next slot boundary, then every 15 minutes (AC-19)", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const { result } = renderHook(() => useLivePrices(BOTH_OK))

    await advance(7.5 * MIN - 1)
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:07:30.000Z")
    await advance(1)
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:15:00.000Z")

    await advance(15 * MIN - 1)
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:15:00.000Z")
    await advance(1)
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:30:00.000Z")
  })

  it("does not fetch at a slot change when both days are ok (AC-20)", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    renderHook(() => useLivePrices(BOTH_OK))
    await advance(60 * MIN)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fetches at a slot change while tomorrow is missing and takes the new payload (AC-20)", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const fresh = payload(okDay("2026-10-06"), okDay("2026-10-07"), "2026-10-06T10:15:00.000Z")
    fetchMock.mockResolvedValueOnce(jsonResponse(fresh))
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))

    await advance(7.5 * MIN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/prices", expect.objectContaining({ cache: "no-store" }))
    expect(result.current.payload).toEqual(fresh)

    // Both days ok now → no more requests at later slot changes.
    await advance(30 * MIN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("promotes tomorrow to today at midnight right away, then replaces it with the server payload (AC-21)", async () => {
    vi.setSystemTime(new Date("2026-10-06T21:59:00Z"))
    const server = payload(okDay("2026-10-07", 55), { date: "2026-10-08", status: "not_published" }, "2026-10-06T22:00:00.000Z")
    let resolveFetch: (r: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolveFetch = r)))
    const { result } = renderHook(() => useLivePrices(BOTH_OK))

    await advance(1 * MIN)
    expect(result.current.now.toISOString()).toBe("2026-10-06T22:00:00.000Z")
    // Promoted locally before the server answered.
    expect(result.current.payload.today).toEqual(BOTH_OK.tomorrow)
    expect(result.current.payload.tomorrow).toEqual({ date: "2026-10-08", status: "not_published" })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch(jsonResponse(server))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.payload).toEqual(server)
  })

  it("keeps the shown payload silently when the refetch fails (EC-8)", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503))
    fetchMock.mockResolvedValueOnce(
      jsonResponse(payload({ date: "2026-10-06", status: "error" }, { date: "2026-10-07", status: "not_published" })),
    )
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))

    await advance(7.5 * MIN) // network error
    await advance(15 * MIN) // 503
    await advance(15 * MIN) // 200 with today.status = error
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.current.payload).toBe(TOMORROW_MISSING)
  })

  it("shows the error state after a day change when nothing can be promoted and the fetch fails (EC-8)", async () => {
    vi.setSystemTime(new Date("2026-10-06T21:59:00Z"))
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))

    await advance(1 * MIN)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.payload.today).toEqual({ date: "2026-10-07", status: "error" })
    expect(result.current.payload.tomorrow).toEqual({ date: "2026-10-08", status: "not_published" })
  })

  it("takes an error response after a day change when nothing fits today any more", async () => {
    vi.setSystemTime(new Date("2026-10-06T21:59:00Z"))
    const errorResponse = payload({ date: "2026-10-07", status: "error" }, { date: "2026-10-08", status: "not_published" })
    fetchMock.mockResolvedValueOnce(jsonResponse(errorResponse))
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))

    await advance(1 * MIN)
    expect(result.current.payload).toEqual(errorResponse)
  })

  it("reloads the page on 401 (session expired)", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const reload = vi.fn()
    vi.stubGlobal("location", { ...window.location, reload })
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))

    await advance(7.5 * MIN)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(result.current.payload).toBe(TOMORROW_MISSING)
  })

  it("recomputes now and runs the check when the page becomes visible again, then reschedules (EC-7)", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const fresh = payload(okDay("2026-10-06"), okDay("2026-10-07"))
    fetchMock.mockResolvedValueOnce(jsonResponse(fresh))
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))

    // Standby: the clock jumps 40 minutes, the timer did not fire.
    setVisibility("hidden")
    vi.setSystemTime(new Date("2026-10-06T10:47:10Z"))
    setVisibility("visible")
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:47:10.000Z")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.payload).toEqual(fresh)

    // Rescheduled to the next real boundary (11:00), not a stale one.
    await advance(12 * MIN + 50 * 1000 - 1)
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:47:10.000Z")
    await advance(1)
    expect(result.current.now.toISOString()).toBe("2026-10-06T11:00:00.000Z")
  })

  it("does nothing on visibilitychange to hidden", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const { result } = renderHook(() => useLivePrices(TOMORROW_MISSING))
    vi.setSystemTime(new Date("2026-10-06T10:10:00Z"))
    setVisibility("hidden")
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.now.toISOString()).toBe("2026-10-06T10:07:30.000Z")
  })

  it("retry() always fetches, sets retrying while it runs and replaces the payload (AC-23)", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const errorInitial = payload({ date: "2026-10-06", status: "error" }, { date: "2026-10-07", status: "not_published" })
    const fresh = payload(okDay("2026-10-06"), okDay("2026-10-07"))
    let resolveFetch: (r: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolveFetch = r)))
    const { result } = renderHook(() => useLivePrices(errorInitial))
    expect(result.current.retrying).toBe(false)

    let done: Promise<void> = Promise.resolve()
    act(() => {
      done = result.current.retry()
    })
    expect(result.current.retrying).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch(jsonResponse(fresh))
      await done
    })
    expect(result.current.retrying).toBe(false)
    expect(result.current.payload).toEqual(fresh)
  })

  it("retry() fetches even when both days are ok", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    fetchMock.mockResolvedValueOnce(jsonResponse(BOTH_OK))
    const { result } = renderHook(() => useLivePrices(BOTH_OK))
    await act(async () => {
      await result.current.retry()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("retry() that fails keeps the error state for today", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const errorInitial = payload({ date: "2026-10-06", status: "error" }, { date: "2026-10-07", status: "not_published" })
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500))
    const { result } = renderHook(() => useLivePrices(errorInitial))
    await act(async () => {
      await result.current.retry()
    })
    expect(result.current.payload.today.status).toBe("error")
    expect(result.current.retrying).toBe(false)
  })

  it("does not start a second request while one is in flight", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    fetchMock.mockReturnValue(new Promise<Response>(() => {}))
    renderHook(() => useLivePrices(TOMORROW_MISSING))
    await advance(7.5 * MIN)
    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      document.dispatchEvent(new Event("visibilitychange"))
      await vi.advanceTimersByTimeAsync(15 * MIN)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("clears its timer and listeners on unmount", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:07:30Z"))
    const { unmount } = renderHook(() => useLivePrices(TOMORROW_MISSING))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await vi.advanceTimersByTimeAsync(60 * MIN)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
