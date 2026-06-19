'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Button } from '@/components/ui/button'
import { Camera, Upload, X } from 'lucide-react'

type BarcodeScannerProps = {
  onDetected: (code: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Starting camera…')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader
    let cancelled = false

    async function start() {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (result && !cancelled) {
              onDetected(result.getText())
            }
          },
        )
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setStatus('Point the camera at a barcode')
      } catch (err) {
        console.error('[v0] camera error:', err)
        setError(
          'Could not access the camera. You can upload a photo of the barcode instead.',
        )
      }
    }
    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [onDetected])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !readerRef.current) return
    setError(null)
    setStatus('Reading image…')
    const url = URL.createObjectURL(file)
    try {
      const result = await readerRef.current.decodeFromImageUrl(url)
      onDetected(result.getText())
    } catch (err) {
      console.error('[v0] image decode error:', err)
      setError('No barcode found in that image. Try a clearer, closer photo.')
      setStatus('Point the camera at a barcode')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden border-2 border-ink bg-ink">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/3 w-2/3 border-2 border-red/80" />
        </div>
        <div className="absolute left-0 top-0 flex items-center gap-1 bg-ink px-2 py-1">
          <Camera className="h-3.5 w-3.5 text-gold" />
          <span className="ed-kicker text-[9px] text-paper">Live Scan</span>
        </div>
      </div>

      {error ? (
        <p className="border-l-2 border-red bg-red-light px-3 py-2 text-xs text-ink">
          {error}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">{status}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 rounded-none border-ink"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-1.5 h-4 w-4" /> Upload photo
        </Button>
        <Button
          type="button"
          className="flex-1 rounded-none bg-ink text-paper hover:bg-ink/90"
          onClick={onClose}
        >
          <X className="mr-1.5 h-4 w-4" /> Close
        </Button>
      </div>
    </div>
  )
}
