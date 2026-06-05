import { describe, expect, it } from 'vitest'
import { parseIssueUrl } from './github-url'

describe('parseIssueUrl', () => {
  it('parses a standard issue URL', () => {
    const r = parseIssueUrl('https://github.com/facebook/react/issues/123')
    expect(r).toEqual({ owner: 'facebook', repo: 'react', number: 123 })
  })

  it('parses URL with query string and fragment', () => {
    const r = parseIssueUrl(
      'https://github.com/vercel/next.js/issues/456?foo=bar#issuecomment-789',
    )
    expect(r).toEqual({ owner: 'vercel', repo: 'next.js', number: 456 })
  })

  it('returns null for invalid or non-issue URL', () => {
    expect(parseIssueUrl('https://github.com/foo/bar/pull/1')).toBeNull()
    expect(parseIssueUrl('not a url')).toBeNull()
    expect(parseIssueUrl('')).toBeNull()
  })
})
