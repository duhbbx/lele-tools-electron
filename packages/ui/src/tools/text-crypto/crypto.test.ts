import { describe, expect, it } from 'vitest'
import { decryptText, encryptText } from './crypto'

describe('text crypto (AES-256-GCM + PBKDF2)', () => {
  it('roundtrips', async () => {
    const ct = await encryptText('机密 secret 🤫', 'pass123')
    expect(ct).not.toContain('机密')
    expect(await decryptText(ct, 'pass123')).toBe('机密 secret 🤫')
  })
  it('wrong password rejects', async () => {
    const ct = await encryptText('x', 'right')
    await expect(decryptText(ct, 'wrong')).rejects.toThrow()
  })
  it('garbage input rejects', async () => {
    await expect(decryptText('not-a-payload', 'p')).rejects.toThrow()
  })
})
