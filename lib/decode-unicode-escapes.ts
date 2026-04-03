const HEX4 = /^[0-9a-fA-F]{4}$/

/**
 * Turns literal `\uXXXX` sequences (and UTF-16 surrogate pairs) into real Unicode characters.
 * Use when text in the DB contains JSON-style escapes as actual characters, e.g. `\u0394` → Δ.
 */
export function decodeUnicodeEscapes(input: string): string {
  let i = 0
  let out = ""
  while (i < input.length) {
    if (
      input[i] === "\\" &&
      input[i + 1] === "u" &&
      i + 6 <= input.length &&
      HEX4.test(input.slice(i + 2, i + 6))
    ) {
      const high = parseInt(input.slice(i + 2, i + 6), 16)
      if (
        high >= 0xd800 &&
        high <= 0xdbff &&
        i + 12 <= input.length &&
        input[i + 6] === "\\" &&
        input[i + 7] === "u" &&
        HEX4.test(input.slice(i + 8, i + 12))
      ) {
        const low = parseInt(input.slice(i + 8, i + 12), 16)
        if (low >= 0xdc00 && low <= 0xdfff) {
          const cp = (high - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000
          out += String.fromCodePoint(cp)
          i += 12
          continue
        }
      }
      out += String.fromCharCode(high)
      i += 6
      continue
    }
    out += input[i]!
    i += 1
  }
  return out
}

/** Recursively decode string leaves (e.g. citation `sourceMetadata` JSON). */
export function decodeUnicodeEscapesDeep<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value === "string") return decodeUnicodeEscapes(value) as T
  if (Array.isArray(value)) {
    return value.map((item) => decodeUnicodeEscapesDeep(item)) as T
  }
  if (typeof value === "object") {
    if (value instanceof Date) return value
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
      out[key] = decodeUnicodeEscapesDeep(obj[key])
    }
    return out as T
  }
  return value
}
