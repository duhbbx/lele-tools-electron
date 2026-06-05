/** AES-256-GCM，密钥由 PBKDF2(SHA-256, 100k) 从口令派生；payload = base64(salt16 + iv12 + ct)。 */

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(saltBuf), iterations: 100_000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function toB64(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s)
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0))
}

export async function encryptText(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)),
  )
  const out = new Uint8Array(salt.length + iv.length + ct.length)
  out.set(salt, 0)
  out.set(iv, 16)
  out.set(ct, 28)
  return toB64(out)
}

export async function decryptText(payload: string, password: string): Promise<string> {
  const bytes = fromB64(payload)
  if (bytes.length < 29) throw new Error('payload 太短，不是合法密文')
  const key = await deriveKey(password, bytes.slice(0, 16))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(16, 28) }, key, bytes.slice(28))
  return new TextDecoder().decode(plain)
}
