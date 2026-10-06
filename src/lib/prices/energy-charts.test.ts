// Never hits the real API (2 requests/min/IP): every test injects a fake fetch.
vi.mock('server-only', () => ({}))

import { fetchEnergyChartsPrices, parseRetryAfter } from './energy-charts'

type FetchArgs = Parameters<typeof fetch>

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init })

const fakeFetch = (response: Response | (() => Promise<Response>)) =>
  vi.fn(async (..._args: FetchArgs) =>
    typeof response === 'function' ? response() : response
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>

// A fetch that only settles when its signal aborts, like the real one.
const hangingFetch = () =>
  vi.fn(
    (_url: FetchArgs[0], init?: FetchArgs[1]) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
  ) as unknown as typeof fetch

const fetchPrices = (fetchImpl: typeof fetch, timeoutMs?: number) =>
  fetchEnergyChartsPrices('2026-10-06', '2026-10-07', { fetchImpl, timeoutMs })

describe('fetchEnergyChartsPrices – request', () => {
  it('asks for DE-LU with the given start and end dates and bypasses the Next fetch cache', async () => {
    const fetchImpl = fakeFetch(jsonResponse({ unix_seconds: [], price: [] }))
    await fetchPrices(fetchImpl)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as FetchArgs
    const parsed = new URL(String(url))
    expect(parsed.origin + parsed.pathname).toBe('https://api.energy-charts.info/price')
    expect(parsed.searchParams.get('bzn')).toBe('DE-LU')
    expect(parsed.searchParams.get('start')).toBe('2026-10-06')
    expect(parsed.searchParams.get('end')).toBe('2026-10-07')
    expect(init?.cache).toBe('no-store')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('fetchEnergyChartsPrices – success (AC-4)', () => {
  it('maps unix seconds to UTC ISO and keeps null, negative and unrounded prices', async () => {
    const fetchImpl = fakeFetch(
      jsonResponse({
        license_info: 'CC BY 4.0 (creativecommons.org/licenses/by/4.0) from Bundesnetzagentur | SMARD.de',
        unix_seconds: [1791237600, 1791238500, 1791239400],
        price: [87.123, null, -4.56],
        unit: 'EUR / MWh',
        deprecated: false,
      })
    )

    expect(await fetchPrices(fetchImpl)).toEqual({
      ok: true,
      points: [
        { start: '2026-10-05T22:00:00.000Z', priceEurMwh: 87.123 },
        { start: '2026-10-05T22:15:00.000Z', priceEurMwh: null },
        { start: '2026-10-05T22:30:00.000Z', priceEurMwh: -4.56 },
      ],
    })
  })

  it('accepts empty arrays as zero points', async () => {
    const fetchImpl = fakeFetch(jsonResponse({ unix_seconds: [], price: [] }))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: true, points: [] })
  })
})

describe('fetchEnergyChartsPrices – invalid response (AC-23)', () => {
  it('rejects arrays of different length', async () => {
    const fetchImpl = fakeFetch(jsonResponse({ unix_seconds: [1791237600, 1791238500], price: [10] }))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: false, kind: 'invalid' })
  })

  it('rejects non-integer timestamps', async () => {
    const fetchImpl = fakeFetch(jsonResponse({ unix_seconds: [1791237600.5], price: [10] }))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: false, kind: 'invalid' })
  })

  it('rejects non-numeric prices', async () => {
    const fetchImpl = fakeFetch(jsonResponse({ unix_seconds: [1791237600], price: ['10'] }))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: false, kind: 'invalid' })
  })

  it('rejects a body that is not JSON', async () => {
    const fetchImpl = fakeFetch(new Response('<html>oops</html>', { status: 200 }))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: false, kind: 'invalid' })
  })
})

describe('fetchEnergyChartsPrices – HTTP errors (AC-23)', () => {
  it('reports 404 ("No content available") as an http error with its status', async () => {
    const fetchImpl = fakeFetch(new Response('No content available', { status: 404 }))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: false, kind: 'http', status: 404 })
  })

  it('reports 500 as an http error with its status', async () => {
    const fetchImpl = fakeFetch(new Response('boom', { status: 500 }))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: false, kind: 'http', status: 500 })
  })

  it('reports 429 as rate_limited with Retry-After in seconds', async () => {
    const fetchImpl = fakeFetch(
      new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '120' } })
    )
    expect(await fetchPrices(fetchImpl)).toEqual({
      ok: false,
      kind: 'rate_limited',
      status: 429,
      retryAfterSeconds: 120,
    })
  })

  it('reports 429 without Retry-After as rate_limited without a wait time', async () => {
    const fetchImpl = fakeFetch(new Response('Too Many Requests', { status: 429 }))
    const result = await fetchPrices(fetchImpl)
    expect(result).toMatchObject({ ok: false, kind: 'rate_limited' })
    expect(result.ok === false && result.retryAfterSeconds).toBeUndefined()
  })
})

describe('fetchEnergyChartsPrices – transport errors (AC-23)', () => {
  it('reports a rejected fetch as a network error', async () => {
    const fetchImpl = fakeFetch(() => Promise.reject(new TypeError('fetch failed')))
    expect(await fetchPrices(fetchImpl)).toEqual({ ok: false, kind: 'network' })
  })

  it('aborts a hanging request after the timeout and reports timeout', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl = hangingFetch()
      const pending = fetchPrices(fetchImpl)
      await vi.advanceTimersByTimeAsync(7_999)
      let settled = false
      void pending.then(() => (settled = true))
      await Promise.resolve()
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(await pending).toEqual({ ok: false, kind: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('honours an injected timeout', async () => {
    expect(await fetchPrices(hangingFetch(), 10)).toEqual({ ok: false, kind: 'timeout' })
  })
})

describe('parseRetryAfter', () => {
  it('reads whole seconds and ignores everything else', () => {
    expect(parseRetryAfter('120')).toBe(120)
    expect(parseRetryAfter(' 30 ')).toBe(30)
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter('')).toBeUndefined()
    expect(parseRetryAfter('1.5')).toBeUndefined()
    expect(parseRetryAfter('-5')).toBeUndefined()
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT')).toBeUndefined()
  })
})
