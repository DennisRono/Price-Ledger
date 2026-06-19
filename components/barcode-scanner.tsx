'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Button } from '@/components/ui/button'
import { Camera, Upload, X, Copy, RefreshCw, Check } from 'lucide-react'

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
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Prevents multiple detections while still streaming
  const codeDetectedRef = useRef(false)
  // Cleanup flag
  const cancelledRef = useRef(false)

  // ─── Camera start / restart ──────────────────────────────
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return

    // Reset state for a fresh scan
    setError(null)
    setScannedCode(null)
    setCopied(false)
    codeDetectedRef.current = false
    setStatus('Starting camera…')

    try {
      // Always create a fresh reader to avoid internal state leaks
      readerRef.current = new BrowserMultiFormatReader(undefined, 500) // 500ms between scans

      const controls = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          // Bail out if the component is being torn down
          if (cancelledRef.current) return
          // Only process the first valid detection
          if (result && !codeDetectedRef.current) {
            codeDetectedRef.current = true
            const code = result.getText()
            setScannedCode(code)
            setStatus('Barcode detected')
            // Keep the video stream alive so the user can see the last frame
          }
        },
      )

      // If unmount happened while camera was starting, tear it down
      if (cancelledRef.current) {
        controls.stop()
        return
      }

      controlsRef.current = controls
      setStatus('Point the camera at a barcode')
    } catch (err) {
      console.error('[BarcodeScanner] camera error:', err)
      if (!cancelledRef.current) {
        setError(
          'Could not access the camera. You can upload a photo of the barcode instead.',
        )
      }
    }
  }, [])

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => {
      cancelledRef.current = true
      controlsRef.current?.stop()
    }
  }, [startCamera])

  // ─── File upload handling ──────────────────────────────
  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !readerRef.current) return

      setError(null)
      setStatus('Reading image…')
      const url = URL.createObjectURL(file)

      try {
        const result = await readerRef.current.decodeFromImageUrl(url)
        const code = result.getText()
        setScannedCode(code)
        setStatus('Barcode detected')
        // Prevent any future camera detection from overwriting the manually selected code
        codeDetectedRef.current = true
      } catch (err) {
        console.error('[BarcodeScanner] image decode error:', err)
        setError('No barcode found in that image. Try a clearer, closer photo.')
        setStatus('Point the camera at a barcode')
        // Re‑enable camera detection so the user can try again
        codeDetectedRef.current = false
      } finally {
        URL.revokeObjectURL(url)
      }
    },
    [],
  )

  // ─── Copy scanned code to clipboard ─────────────────────
  const handleCopy = useCallback(async () => {
    if (!scannedCode) return
    try {
      await navigator.clipboard.writeText(scannedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for insecure contexts (e.g. http)
      const textarea = document.createElement('textarea')
      textarea.value = scannedCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [scannedCode])

  // ─── Confirm & close ────────────────────────────────────
  const handleConfirm = () => {
    if (scannedCode) {
      onDetected(scannedCode)
      onClose()
    }
  }

  // ─── Rescan – simply clear the detected code and re‑enable camera ──
  const handleRescan = () => {
    setScannedCode(null)
    setError(null)
    setCopied(false)
    codeDetectedRef.current = false
    setStatus('Point the camera at a barcode')
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Video container ──────────────────────────────── */}
      <div className="relative overflow-hidden border-2 border-ink bg-ink">
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          playsInline
          muted
        />
        {/* Viewfinder overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-2/3 w-2/3 border-2 border-red/80" />
        </div>
        {/* Status badge */}
        <div className="absolute left-0 top-0 flex items-center gap-1 bg-ink px-2 py-1">
          <Camera className="h-3.5 w-3.5 text-gold" />
          <span className="ed-kicker text-[9px] text-paper">Live Scan</span>
        </div>
      </div>

      {/* ─── Status / error ───────────────────────────────── */}
      {error ? (
        <p className="border-l-2 border-red bg-red-light px-3 py-2 text-xs text-ink">
          {error}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">{status}</p>
      )}

      {/* ─── Scanned code input ───────────────────────────── */}
      {scannedCode && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={scannedCode}
            readOnly
            className="flex-1 rounded-none border-2 border-ink bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-gold/50"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-none border-2 border-ink bg-ink p-2 text-paper transition-colors hover:bg-ink/90"
            aria-label={copied ? 'Copied' : 'Copy barcode'}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* ─── Hidden file input ────────────────────────────── */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {/* ─── Action buttons ───────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Confirm button – visible only when a code has been scanned */}
        {scannedCode && (
          <Button
            type="button"
            className="flex-1 rounded-none bg-ink text-paper hover:bg-ink/90"
            onClick={handleConfirm}
          >
            <Check className="mr-1.5 h-4 w-4" /> Confirm
          </Button>
        )}

        {/* Rescan button – visible when a code was detected or an error occurred */}
        {scannedCode || error ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-none border-ink"
            onClick={handleRescan}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> Rescan
          </Button>
        ) : null}

        {/* Upload photo button */}
        <Button
          type="button"
          variant="outline"
          className="flex-1 rounded-none border-ink"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-1.5 h-4 w-4" /> Upload photo
        </Button>

        {/* Close button */}
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