// Open-redirect guard: only allow same-origin internal paths.
// Prevents `?next=https://evil.example.com/steal` and `?next=//evil.com`.
export function safeNext(raw, fallback = '/app') {
  if (!raw || typeof raw !== 'string') return fallback
  // Must start with a single forward slash, not protocol-relative `//`.
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  // Disallow control characters / whitespace
  if (/[\s\x00-\x1f]/.test(raw)) return fallback
  return raw
}

// Read and validate `?next=` from the current URL search params
export function readNext(searchParams, fallback = '/app') {
  const raw = searchParams.get?.('next') ?? null
  return safeNext(raw, fallback)
}
