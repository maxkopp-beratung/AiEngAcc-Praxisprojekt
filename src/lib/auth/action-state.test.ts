// Error classification and message helpers shared by all PROJ-1 actions (AC-10, EC-4, EC-5).
import { isConnectionError, isMailError, lockedMessage, textValue } from './action-state'

describe('lockedMessage', () => {
  it('names the remaining minutes in German, singular for one minute (AC-10)', () => {
    expect(lockedMessage(1)).toBe('Zu viele Fehlversuche. Bitte versuche es in 1 Minute erneut.')
    expect(lockedMessage(15)).toBe('Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut.')
  })
})

describe('textValue', () => {
  it('passes strings through and turns missing fields and files into an empty string', () => {
    expect(textValue('max@example.de')).toBe('max@example.de')
    expect(textValue(null)).toBe('')
    expect(textValue(new File(['x'], 'evil.txt'))).toBe('')
  })
})

describe('isConnectionError (EC-5)', () => {
  it('treats retryable fetch errors and responses without status as connection problems', () => {
    expect(isConnectionError({ name: 'AuthRetryableFetchError', status: 502 })).toBe(true)
    expect(isConnectionError({ name: 'AuthApiError', status: 0 })).toBe(true)
    expect(isConnectionError({ name: 'AuthApiError', status: undefined })).toBe(true)
  })

  it('does not treat a normal API answer as a connection problem', () => {
    expect(isConnectionError({ name: 'AuthApiError', status: 400 })).toBe(false)
    expect(isConnectionError({ name: 'AuthApiError', status: 429 })).toBe(false)
  })
})

describe('isMailError (EC-4)', () => {
  it('recognises an exhausted mail quota and SMTP failures', () => {
    expect(isMailError({ code: 'over_email_send_rate_limit', status: 429 })).toBe(true)
    expect(isMailError({ code: 'unexpected_failure', status: 500 })).toBe(true)
    expect(isMailError({ code: undefined, status: 503 })).toBe(true)
  })

  it('does not treat client errors or other rate limits as a mail problem', () => {
    expect(isMailError({ code: 'over_request_rate_limit', status: 429 })).toBe(false)
    expect(isMailError({ code: 'invalid_credentials', status: 400 })).toBe(false)
    expect(isMailError({ code: undefined, status: undefined })).toBe(false)
  })
})
