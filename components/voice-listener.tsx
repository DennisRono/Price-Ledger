'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '@/lib/types'
import { formatPrice } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, X, ImageOff } from 'lucide-react'
import {
  buildSearchIndex,
  searchProducts,
  isClearCommand,
} from '@/lib/voice-search'

type VoiceListenerProps = {
  products: Product[]
  onPick: (product: Product) => void
}

// Minimal typing for the Web Speech API
type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!Ctor) return null
  return new Ctor() as SpeechRecognitionLike
}

const LONG_PAUSE_MS = 30000 // 30 seconds of silence before a new utterance resets the search

export function VoiceListener({ products, onPick }: VoiceListenerProps) {
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [matches, setMatches] = useState<Product[]>([])
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListen = useRef(false)
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPauseFlag = useRef(false) // becomes true after 30 s of silence

  // Pre‑build the search index once (or when the product list changes)
  const searchIndex = useMemo(() => buildSearchIndex(products), [products])

  // Cleanup on unmount
  useEffect(() => {
    setSupported(getRecognition() !== null)
    return () => {
      shouldListen.current = false
      recRef.current?.stop()
      if (pauseTimer.current) clearTimeout(pauseTimer.current)
    }
  }, [])

  /** Run the fuzzy search and update the suggestion list. */
  function findMatches(text: string) {
    if (!text.trim()) {
      setMatches([])
      return
    }
    // Check for a voice “clear” command
    if (isClearCommand(text)) {
      handleClear()
      return
    }
    const results = searchProducts(text, searchIndex, 12)
    setMatches(results.map((r) => r.product))
  }

  /** Reset the session and recognition (used for clear command or after a long pause). */
  function handleClear() {
    setMatches([])
    setTranscript('')
    longPauseFlag.current = false
    if (pauseTimer.current) clearTimeout(pauseTimer.current)
    // Stop and restart to reset the continuous recognition’s accumulated text
    if (recRef.current && shouldListen.current) {
      recRef.current.stop()
      // The onend handler will re‑start because shouldListen is still true
    }
  }

  /** Schedule a flag that will mark the next utterance as a fresh search. */
  function resetPauseTimer() {
    if (pauseTimer.current) clearTimeout(pauseTimer.current)
    longPauseFlag.current = false
    pauseTimer.current = setTimeout(() => {
      // Mark that any future speech should be treated as a new query
      if (shouldListen.current) {
        longPauseFlag.current = true
      }
    }, LONG_PAUSE_MS)
  }

  function start() {
    const rec = getRecognition()
    if (!rec) {
      setSupported(false)
      return
    }
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: any) => {
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript + ' '
      }
      const trimmed = text.trim()

      // If a long pause had occurred, treat this as a brand‑new utterance
      if (longPauseFlag.current && trimmed.length > 0) {
        longPauseFlag.current = false
        // Save the text, then restart the recognition to clear its buffer
        handleClear()
        // After the clear (which resets transcript/matches), inject the new text
        setTranscript(trimmed)
        findMatches(trimmed)
        resetPauseTimer()
        return
      }

      // Normal update – refine the same search
      setTranscript(trimmed)
      findMatches(trimmed)
      resetPauseTimer()
    }

    rec.onerror = () => {
      /* ignore transient errors */
    }

    rec.onend = () => {
      if (shouldListen.current) {
        try {
          rec.start()
        } catch {
          /* already started */
        }
      } else {
        setListening(false)
      }
    }

    recRef.current = rec
    shouldListen.current = true
    try {
      rec.start()
      setListening(true)
    } catch {
      /* noop */
    }
  }

  function stop() {
    shouldListen.current = false
    recRef.current?.stop()
    setListening(false)
    if (pauseTimer.current) clearTimeout(pauseTimer.current)
    longPauseFlag.current = false
  }

  if (!supported) {
    return (
      <div className="border-l-2 border-gold bg-gold-light/40 px-3 py-2 text-xs text-ink">
        Voice listening is not supported in this browser. Try Chrome on Android or
        desktop.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-2 border-ink bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 items-center justify-center border-2 border-ink ${
              listening ? 'animate-pulse bg-red text-paper' : 'bg-parchment text-ink'
            }`}
          >
            {listening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </span>
          <div>
            <p className="ed-kicker text-[10px] text-muted-foreground">
              Listening Mode
            </p>
            <p className="text-sm font-semibold">
              {listening ? 'Listening for product names…' : 'Tap to start'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {matches.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none border-ink"
              onClick={() => {
                setMatches([])
                setTranscript('')
                if (pauseTimer.current) clearTimeout(pauseTimer.current)
                longPauseFlag.current = false
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className={`rounded-none ${
              listening
                ? 'bg-ink text-paper hover:bg-ink/90'
                : 'bg-red text-paper hover:bg-red/90'
            }`}
            onClick={listening ? stop : start}
          >
            {listening ? 'Stop' : 'Listen'}
          </Button>
        </div>
      </div>

      {transcript ? (
        <p className="border-l-2 border-gold bg-parchment px-2 py-1 text-xs italic text-muted-foreground">
          “{transcript}”
        </p>
      ) : null}

      {matches.length > 0 ? (
        <ul className="flex flex-col divide-y divide-ink/10 border border-ink/15">
          {matches.map((p) => {
            // Extract active promotions (offers) just like SearchBar
            const activePromotions =
              p.promotions?.filter((pr: any) => pr.active) ?? []
            const promotionLabels = activePromotions
              .map((pr: any) => pr.label)
              .join(', ')

            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="flex w-full items-center gap-3 bg-card px-2 py-2 text-left hover:bg-parchment"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-parchment">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url || '/placeholder.svg'}
                        alt=""
                        className="h-full w-full object-contain mix-blend-multiply"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <ImageOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {p.name}
                  </span>
                  {/* Price + Promotion */}
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="font-heading text-base font-black text-red">
                      {formatPrice(
                        p.pricing?.unit_price_cents,
                        p.pricing?.currency,
                      )}
                    </span>
                    {promotionLabels && (
                      <span className="text-xs font-medium text-green-600">
                        {promotionLabels}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}