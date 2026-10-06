import { fireEvent, render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'

import type { RecommendationText } from '@/lib/devices/recommendation-text'
import type { Device } from '@/lib/devices/types'

import { DeviceCard } from './device-card'
import { RecommendationBlock } from './recommendation-block'

// Radix DropdownMenu (floating-ui) needs a few browser APIs jsdom lacks.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  Element.prototype.scrollIntoView ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
})

const washer: Device = {
  id: 'd1',
  name: 'Waschmaschine',
  durationMinutes: 150,
  createdAt: '2026-10-06T08:00:00.000Z',
}

const recommendation: RecommendationText = {
  kind: 'recommendation',
  headline: 'Starte um 13:15 Uhr · fertig um 15:45 Uhr · Ø 8,4 ct/kWh',
  detail: 'Sofort: Ø 11,7 ct/kWh – du sparst 3,3 ct/kWh (28 %)',
  tomorrowHint: 'Die Preise für morgen fehlen noch – die Empfehlung kann sich ab ca. 13 Uhr ändern.',
}

function renderCard(device: Device = washer, rec: RecommendationText | null = recommendation) {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const utils = render(<DeviceCard device={device} recommendation={rec} onEdit={onEdit} onDelete={onDelete} />)
  return { ...utils, onEdit, onDelete }
}

function openMenu(name = 'Waschmaschine') {
  const trigger = screen.getByRole('button', { name: `Aktionen für ${name}` })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  return screen.getByRole('menu')
}

describe('DeviceCard', () => {
  it('shows the name as heading and the run time as "2:30 h"', () => {
    renderCard()
    expect(screen.getByRole('heading', { level: 3, name: 'Waschmaschine' })).toBeInTheDocument()
    expect(screen.getByText('2:30 h')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Waschmaschine' })).toBeInTheDocument()
  })

  it('renders an HTML-like name literally, without creating elements (EC-12)', () => {
    const { container } = renderCard({ ...washer, name: '<b>Trockner</b>' })
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('<b>Trockner</b>')
    expect(container.querySelector('b')).toBeNull()
  })

  it('keeps a 40-character name without spaces in the DOM, breakable anywhere (EC-13)', () => {
    const long = 'A'.repeat(40)
    renderCard({ ...washer, name: long })
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent(long)
    expect(heading.className).toContain('[overflow-wrap:anywhere]')
    expect(heading.parentElement?.className).toContain('min-w-0')
  })

  it('labels the menu button "Aktionen für <Name>"', () => {
    renderCard()
    expect(screen.getByRole('button', { name: 'Aktionen für Waschmaschine' })).toBeInTheDocument()
  })

  it('calls onEdit (only) when "Bearbeiten" is chosen (AC-11)', () => {
    const { onEdit, onDelete } = renderCard()
    const menu = openMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Bearbeiten' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('calls onDelete (only) when "Löschen" is chosen (AC-12)', () => {
    const { onEdit, onDelete } = renderCard()
    const menu = openMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Löschen' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('shows the recommendation block below the header', () => {
    renderCard()
    expect(screen.getByText('Starte um 13:15 Uhr · fertig um 15:45 Uhr · Ø 8,4 ct/kWh')).toBeInTheDocument()
  })

  it('shows a skeleton while the recommendation is null', () => {
    renderCard(washer, null)
    expect(screen.getByTestId('recommendation-skeleton')).toBeInTheDocument()
  })
})

describe('RecommendationBlock', () => {
  it('null → skeleton lines, no recommendation text', () => {
    const { container } = render(<RecommendationBlock text={null} />)
    expect(screen.getByTestId('recommendation-skeleton')).toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(container.querySelector('p')).toBeNull()
    expect(container.textContent).toBe('Empfehlung wird berechnet') // sr-only only
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true')
  })

  it('notice → shows the text (AC-18, AC-23, EC-14)', () => {
    const text = 'Für 4:00 h sind noch nicht genug Preise bekannt. Die Preise für morgen erscheinen meist ab ca. 13 Uhr.'
    const { container } = render(<RecommendationBlock text={{ kind: 'notice', text }} />)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByTestId('recommendation-skeleton')).toBeNull()
    expect(container.firstElementChild).not.toHaveAttribute('aria-busy')
  })

  it('recommendation → headline, detail and tomorrow hint, politely announced', () => {
    const { container } = render(<RecommendationBlock text={recommendation} />)
    if (recommendation.kind !== 'recommendation') throw new Error('fixture')
    const headline = screen.getByText(recommendation.headline)
    expect(headline.closest('p')).toHaveClass('font-semibold', 'tabular-nums')
    expect(screen.getByText(recommendation.detail!)).toBeInTheDocument()
    expect(screen.getByText(recommendation.tomorrowHint!)).toHaveClass('text-muted-foreground')
    expect(container.firstElementChild).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByTestId('recommendation-skeleton')).toBeNull()
  })

  it('detail null → no detail line (EC-14)', () => {
    const { container } = render(
      <RecommendationBlock text={{ kind: 'recommendation', headline: 'Jetzt starten', detail: null, tomorrowHint: null }} />,
    )
    expect(container.querySelectorAll('p')).toHaveLength(1)
    expect(container.textContent).toBe('Jetzt starten')
  })

  it('tomorrowHint null → no hint line', () => {
    const { container } = render(
      <RecommendationBlock
        text={{ kind: 'recommendation', headline: 'Jetzt starten', detail: 'Günstiger wird es im bekannten Zeitraum nicht.', tomorrowHint: null }}
      />,
    )
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(screen.queryByText(/Preise für morgen/)).toBeNull()
  })
})
