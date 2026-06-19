// lib/voice-search.ts
//
// Fuzzy, voice-friendly product search.
//
// Speech-to-text is messy: numbers come through as words or digits, units
// get mangled ("fl oz" / "ounce" / "oz"), silent letters get transcribed
// literally ("wrap" instead of "rap"), and people drop filler words ("the",
// "gimme me"). This module normalizes both the spoken query and the product
// catalog onto the same canonical token space so they can be compared
// fairly, then scores every product across many weighted fields (name,
// brand, size, packaging, category, tags, description, container) and
// returns the best matches ranked by how likely they are to be what the
// speaker meant.
//
// Nothing here touches the DOM or React — it's pure data in, data out, so
// it can be reused for a typed search box too, independent of the voice UI.

import type { Product } from './types'

export type Category = { id: string; name: string }

export type ScoredProduct = {
  product: Product
  score: number
}

/**
 * Extra fields this module reads beyond whatever your shared `Product` type
 * declares (it likely already includes all of these, since they're in the
 * catalog JSON — this is mostly documentation, and a safety net against
 * TypeScript complaining if it doesn't).
 */
export type ProductFields = {
  receipt_name?: string | null
  description?: string | null
  group_key?: string | null
  tags?: string[] | null
  category?: string | null
  subcategory?: string | null
  container?: string | null
  size?: { value: number; unit: string } | null
  packaging?: { type?: string; units_per_pack?: number } | null
  status?: string | null
  flags?: { discontinued?: boolean } | null
  compliance?: { age_restricted?: boolean } | null
}

export type FullProduct = Product & ProductFields


// Tokenization


const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
}
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30 }

// Words that carry essentially no search signal on their own. Kept short on
// purpose — when in doubt we'd rather let a weak/fuzzy match through than
// silently drop a word the speaker cared about. Notably "can" is NOT here:
// it's filler in "can I get" but also a real container type ("Coke Can"),
// and the latter is more useful to keep.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'please', 'want', 'wanna', 'need', 'some',
  'that', 'this', 'im', 'like', 'gimme', 'find', 'search', 'show', 'looking',
  'okay', 'ok', 'um', 'uh', 'hey', 'give', 'me', 'get', 'for', 'have', 'got', 'do',
])

/** Lowercase, strip punctuation (keeping digit decimals like "18.5" intact), split on whitespace. */
function tokenizeRaw(text: string): string[] {
  const protectedDots = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/(\d)\.(\d)/g, '$1__DOT__$2')
  const cleaned = protectedDots
    .replace(/[^a-z0-9_\s]/g, ' ')
    .replace(/__DOT__/g, '.')
  return cleaned.split(/\s+/).filter(Boolean)
}

/** "twenty four" -> "24", "sixteen" -> "16". Leaves anything it doesn't recognize alone. */
function wordsToNumbers(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (TENS[t] !== undefined) {
      const next = tokens[i + 1]
      if (next !== undefined && ONES[next] !== undefined && ONES[next] > 0) {
        out.push(String(TENS[t] + ONES[next]))
        i++
        continue
      }
      out.push(String(TENS[t]))
      continue
    }
    if (TEENS[t] !== undefined) { out.push(String(TEENS[t])); continue }
    if (ONES[t] !== undefined) { out.push(String(ONES[t])); continue }
    out.push(t)
  }
  return out
}

/** "for pack" is almost always a mis-hearing of "four pack" — only fix it in that exact context. */
function fixCommonMishearings(tokens: string[]): string[] {
  const out = [...tokens]
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i] === 'for' && /^pa?cks?$|^pk$/.test(out[i + 1])) {
      out[i] = '4'
    }
  }
  return out
}

/** Collapse the many ways units get spoken/written down to one canonical form. */
function normalizeUnits(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const next = tokens[i + 1]
    if ((t === 'fl' || t === 'fluid') && next && /^oz$|^ounces?$/.test(next)) {
      out.push('oz')
      i++
      continue
    }
    if (/^ounces?$/.test(t)) { out.push('oz'); continue }
    if (/^liters?$|^litres?$/.test(t)) { out.push('l'); continue }
    if (/^milliliters?$|^millilitres?$/.test(t)) { out.push('ml'); continue }
    if (/^packs?$|^pk$/.test(t)) { out.push('pack'); continue }
    if (/^cans?$/.test(t)) { out.push('can'); continue }
    if (/^bottles?$|^btl$/.test(t)) { out.push('bottle'); continue }
    if (/^gallons?$/.test(t)) { out.push('gal'); continue }
    out.push(t)
  }
  return out
}

/** Split "20oz" into "20oz" + "20" + "oz" so either spoken form ("twenty oz" or "20oz") matches. */
function expandAlnumBoundaries(tokens: string[]): string[] {
  const out: string[] = []
  for (const t of tokens) {
    out.push(t)
    const parts = t.match(/[a-z]+|\d+(?:\.\d+)?/g)
    if (parts && parts.length > 1) out.push(...parts)
  }
  return out
}

/** Full canonicalization pipeline shared by the product catalog (no mishearing fixes needed there). */
export function canonicalTokens(text: string | null | undefined): string[] {
  if (!text) return []
  let tokens = tokenizeRaw(text)
  tokens = wordsToNumbers(tokens)
  tokens = normalizeUnits(tokens)
  tokens = expandAlnumBoundaries(tokens)
  return tokens
}

export type NormalizedQuery = { tokens: string[]; phraseCompact: string }

/** Canonicalize a spoken/typed query into the meaningful, deduplicated tokens used for scoring. */
export function normalizeQuery(raw: string): NormalizedQuery {
  let tokens = tokenizeRaw(raw)
  tokens = wordsToNumbers(tokens)
  tokens = fixCommonMishearings(tokens)
  tokens = normalizeUnits(tokens)
  tokens = expandAlnumBoundaries(tokens)

  const meaningful = tokens.filter(
    (t) => t.length > 0 && !STOPWORDS.has(t) && (t.length >= 2 || /^\d+$/.test(t) || t === 'l')
  )
  const phraseCompact = tokens
    .filter((t) => !STOPWORDS.has(t))
    .join('')
    .replace(/[^a-z0-9]/g, '')

  return { tokens: Array.from(new Set(meaningful)), phraseCompact }
}

/** Tokens used to highlight which parts of a product name matched the query. */
export function highlightTokens(rawQuery: string): string[] {
  return normalizeQuery(rawQuery).tokens.filter((t) => t.length >= 2)
}


// Light phonetic matching — catches silent letters STT often transcribes
// literally (e.g. "wrap" said as "rap", "knife" as "nife").


export function phoneticKey(token: string): string {
  let t = token
  t = t.replace(/^wr/, 'r')
  t = t.replace(/^kn/, 'n')
  t = t.replace(/^gn/, 'n')
  t = t.replace(/^pn/, 'n')
  t = t.replace(/^ps/, 's')
  t = t.replace(/ph/g, 'f')
  t = t.replace(/ck/g, 'k')
  t = t.replace(/(.)\1{2,}/g, '$1') // "soooo" -> "so"
  return t
}


// Edit distance


function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al
  const dp: number[] = new Array(bl + 1)
  for (let j = 0; j <= bl; j++) dp[j] = j
  for (let i = 1; i <= al; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= bl; j++) {
      const temp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return dp[bl]
}


// Index


type WeightedField = { tokens: Set<string>; weight: number }

export type IndexedProduct = {
  product: Product
  fields: WeightedField[]
  nameCompact: string
}

function field(text: string | null | undefined, weight: number): WeightedField {
  return { tokens: new Set(canonicalTokens(text)), weight }
}

function sizeAliasStrings(size: { value: number; unit: string } | null | undefined): string {
  if (!size || size.value == null || !size.unit) return ''
  const v = String(size.value)
  const unitWords: Record<string, string[]> = {
    l: ['l', 'liter', 'liters'],
    ml: ['ml', 'milliliter', 'milliliters'],
    fl_oz: ['oz', 'ounce', 'ounces'],
    oz: ['oz', 'ounce', 'ounces'],
    gal: ['gal', 'gallon', 'gallons'],
  }
  const words = unitWords[size.unit] ?? [size.unit]
  return words.map((w) => `${v}${w} ${v} ${w}`).join(' ')
}

function packagingAliasStrings(
  packaging: { type?: string; units_per_pack?: number } | null | undefined
): string {
  if (!packaging?.units_per_pack || packaging.units_per_pack <= 1) return ''
  const n = packaging.units_per_pack
  const out = [`${n} pack`, `${n}pack`, `${n} pk`, `${n}pk`, 'pack']
  if (n >= 12) out.push('case')
  return out.join(' ')
}

/**
 * Pre-process the catalog once (memoize this in React with useMemo) so every
 * voice update only has to score against pre-built token sets instead of
 * re-tokenizing every product field on every spoken word.
 */
export function buildSearchIndex(products: Product[], categories?: Category[]): IndexedProduct[] {
  const categoryName = new Map<string, string>()
  for (const c of categories ?? []) categoryName.set(c.id, c.name)
  const resolveCategory = (id: string | null | undefined) =>
    (id && (categoryName.get(id) ?? id.replace(/_/g, ' '))) || ''

  return products
    .filter((p) => {
      const fp = p as unknown as FullProduct
      return !fp.flags?.discontinued && fp.status !== 'discontinued'
    })
    .map((p) => {
      const fp = p as unknown as FullProduct
      const fields: WeightedField[] = [
        field(fp.name, 6),
        field(fp.receipt_name, 5),
        field(fp.brand, 5),
        field(typeof fp.group_key === 'string' ? fp.group_key.replace(/_/g, ' ') : '', 4),
        field(Array.isArray(fp.tags) ? fp.tags.join(' ').replace(/_/g, ' ') : '', 4),
        field(packagingAliasStrings(fp.packaging), 4),
        field(sizeAliasStrings(fp.size), 4),
        field(resolveCategory(fp.category), 3),
        field(resolveCategory(fp.subcategory), 3),
        field(fp.container, 2),
        field(fp.description, 1.5),
      ]
      const nameCompact = canonicalTokens(`${fp.name ?? ''} ${fp.receipt_name ?? ''}`)
        .join('')
        .replace(/[^a-z0-9]/g, '')
      return { product: p, fields, nameCompact }
    })
}


// Scoring


/** Best match strength (0..1) between one query token and a field's token set. */
function fieldMatchScore(qt: string, tokens: Set<string>): number {
  if (tokens.size === 0) return 0
  if (tokens.has(qt)) return 1

  let best = 0
  const qtPhon = qt.length >= 3 ? phoneticKey(qt) : null

  for (const t of tokens) {
    if (t.startsWith(qt) || qt.startsWith(t)) {
      if (best < 0.82) best = 0.82
      continue
    }
    if (qt.length >= 3 && (t.includes(qt) || qt.includes(t))) {
      if (best < 0.6) best = 0.6
      continue
    }
    if (qt.length >= 3 && Math.abs(t.length - qt.length) <= 3) {
      const maxDist = qt.length <= 4 ? 1 : 2
      const dist = levenshtein(qt, t)
      if (dist <= maxDist) {
        const ratio = 1 - dist / Math.max(qt.length, t.length)
        if (best < ratio * 0.55) best = ratio * 0.55
        continue
      }
    }
    if (qtPhon && qtPhon === phoneticKey(t)) {
      if (best < 0.5) best = 0.5
    }
  }
  return best
}

function scoreIndexed(indexed: IndexedProduct, tokens: string[], phraseCompact: string): number {
  let total = 0
  let matched = 0

  for (const qt of tokens) {
    let best = 0
    for (const f of indexed.fields) {
      const s = fieldMatchScore(qt, f.tokens) * f.weight
      if (s > best) best = s
    }
    if (best > 0) {
      total += best
      matched++
    }
  }

  if (matched === 0) return 0

  // Reward matching a larger fraction of what was said, without requiring
  // every word to match — a single strong word ("pack") is still a result.
  const coverage = matched / tokens.length
  let score = total * (0.55 + 0.45 * coverage)

  // Big bonus when the spoken phrase, with spaces stripped, appears
  // contiguously in the product's name — about as close to "exact" as a
  // fuzzy matcher should claim.
  if (phraseCompact.length >= 3 && indexed.nameCompact.includes(phraseCompact)) {
    score += 10
  }

  const fp = indexed.product as unknown as FullProduct
  if (fp.status === 'needs_price') score *= 0.92 // still findable, just nudged down

  return score
}

/** Search the pre-built index, returning the best matches sorted by likelihood. */
export function searchProducts(rawQuery: string, index: IndexedProduct[], limit = 12): ScoredProduct[] {
  const { tokens, phraseCompact } = normalizeQuery(rawQuery)
  if (tokens.length === 0) return []

  const scored: ScoredProduct[] = []
  for (const ip of index) {
    const score = scoreIndexed(ip, tokens, phraseCompact)
    if (score > 0) scored.push({ product: ip.product, score })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.product.name.localeCompare(b.product.name)
  })

  return scored.slice(0, limit)
}


// Voice commands


const CLEAR_COMMANDS = new Set([
  'clear', 'reset', 'cancel', 'never mind', 'nevermind', 'start over',
  'clear search', 'clear that', 'clear it', 'clear it out',
])

/** True if the spoken phrase is a "clear the search" command rather than a product query. */
export function isClearCommand(text: string): boolean {
  const stripped = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(please|ok|okay)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped.length > 0 && CLEAR_COMMANDS.has(stripped)
}