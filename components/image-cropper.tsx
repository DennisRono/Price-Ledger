'use client'

import { useEffect, useRef, useState } from 'react'
import { loadImage, compressImage, type CropRect } from '@/lib/image-utils'
import { Button } from '@/components/ui/button'

type ImageCropperProps = {
  src: string
  onCropped: (blob: Blob, previewUrl: string) => void
  onCancel: () => void
}

/**
 * Square crop tool. User drags a square selection over the image.
 * Output is compressed to a tiny WebP/JPEG.
 */
export function ImageCropper({ src, onCropped, onCancel }: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  // crop expressed in 0..1 fractions of displayed image
  const [crop, setCrop] = useState({ x: 0.1, y: 0.1, size: 0.8 })
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<{
    mode: 'move' | 'resize'
    startX: number
    startY: number
    orig: typeof crop
  } | null>(null)

  useEffect(() => {
    let alive = true
    loadImage(src).then((img) => {
      if (!alive) return
      imgRef.current = img
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
      // default centered square
      const ar = img.naturalWidth / img.naturalHeight
      const size = ar >= 1 ? 1 / ar : ar
      setCrop({ x: (1 - (ar >= 1 ? size * ar : 1)) / 2, y: 0, size: Math.min(1, size) })
      setCrop({ x: 0.05, y: 0.05, size: 0.9 })
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [src])

  function pointerPos(e: React.PointerEvent) {
    const rect = wrapRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function startDrag(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.stopPropagation()
    const pos = pointerPos(e)
    dragRef.current = { mode, startX: pos.x, startY: pos.y, orig: crop }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const pos = pointerPos(e)
    const { mode, startX, startY, orig } = dragRef.current
    const dx = pos.x - startX
    const dy = pos.y - startY
    if (mode === 'move') {
      const x = Math.min(Math.max(0, orig.x + dx), 1 - orig.size)
      const y = Math.min(Math.max(0, orig.y + dy), 1 - orig.size)
      setCrop({ ...orig, x, y })
    } else {
      const delta = Math.max(dx, dy)
      const size = Math.min(
        Math.max(0.1, orig.size + delta),
        Math.min(1 - orig.x, 1 - orig.y),
      )
      setCrop({ ...orig, size })
    }
  }

  function endDrag() {
    dragRef.current = null
  }

  async function handleConfirm() {
    if (!imgRef.current) return
    setBusy(true)
    try {
      const rect: CropRect = {
        x: crop.x * naturalSize.w,
        y: crop.y * naturalSize.h,
        width: crop.size * naturalSize.w,
        height: crop.size * naturalSize.h,
      }
      const blob = await compressImage(imgRef.current, rect, 160, 0.5)
      const previewUrl = URL.createObjectURL(blob)
      onCropped(blob, previewUrl)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapRef}
        className="relative mx-auto max-h-[50vh] w-full touch-none select-none overflow-hidden border border-ink bg-parchment"
        onPointerMove={onMove}
        onPointerUp={endDrag}
        style={{ aspectRatio: naturalSize.w && naturalSize.h ? `${naturalSize.w}/${naturalSize.h}` : '1/1' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src || '/placeholder.svg'}
          alt="Crop preview"
          className="pointer-events-none h-full w-full object-contain"
          crossOrigin="anonymous"
        />
        {loaded ? (
          <div
            className="absolute cursor-move border-2 border-paper shadow-[0_0_0_9999px_rgba(13,13,13,0.55)]"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.size * 100}%`,
              height: `${crop.size * 100}%`,
            }}
            onPointerDown={(e) => startDrag('move', e)}
          >
            <span
              className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize border-2 border-ink bg-gold"
              onPointerDown={(e) => startDrag('resize', e)}
            />
          </div>
        ) : null}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Drag to move, drag the corner handle to resize. Image is shrunk to a tiny
        ~160px thumbnail.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 rounded-none border-ink"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1 rounded-none bg-ink text-paper hover:bg-ink/90"
          onClick={handleConfirm}
          disabled={busy || !loaded}
        >
          {busy ? 'Processing…' : 'Use this crop'}
        </Button>
      </div>
    </div>
  )
}
