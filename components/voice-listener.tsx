'use client'

import { useEffect, useRef, useState } from 'react'
import type { Product } from '@/lib/types'
import { formatPrice, productHaystack, normalize } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, X, ImageOff } from 'lucide-react'

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

export function VoiceListener({ products, onPick }: VoiceListenerProps) {
  const [supported, setSupported] = useState(true)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [matches, setMatches] = useState<Product[]>([])
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListen = useRef(false)

  useEffect(() => {
    setSupported(getRecognition() !== null)
    return () => {
      shouldListen.current = false
      recRef.current?.stop()
    }
  }, [])

  function findMatches(text: string) {
    const words = normalize(text)
    if (!words) return
    const found: Product[] = []
    const seen = new Set<string>()
    for (const p of products) {
      const name = normalize(p.name)
      const brand = normalize(p.brand ?? '')
      const hay = productHaystack(p)
      // match if the product's brand or a significant name token is spoken
      const nameTokens = name.split(' ').filter((t) => t.length >= 3)
      const brandHit = brand.length >= 3 && words.includes(brand)
      const nameHit =
        nameTokens.length > 0 &&
        nameTokens.filter((t) => words.includes(t)).length >=
          Math.min(2, nameTokens.length)
      if ((brandHit || nameHit) && !seen.has(p.id)) {
        seen.add(p.id)
        found.push(p)
      }
      if (found.length >= 12) break
    }
    if (found.length > 0) {
      setMatches((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]))
        for (const f of found) byId.set(f.id, f)
        return Array.from(byId.values()).slice(-12)
      })
    }
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
      setTranscript(text.trim())
      // detect "clear" command
      if (/\b(clear|reset|start over)\b/i.test(text)) {
        setMatches([])
        setTranscript('')
        return
      }
      findMatches(text)
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
          {matches.map((p) => (
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
                <span className="font-heading shrink-0 text-base font-black text-red">
                  {formatPrice(p.pricing?.unit_price_cents, p.pricing?.currency)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
