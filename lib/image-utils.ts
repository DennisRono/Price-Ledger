export type CropRect = { x: number; y: number; width: number; height: number }

/** Load a File/Blob/URL into an HTMLImageElement */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Crop + downscale + compress an image into a very small WebP/JPEG blob.
 * maxSize: longest edge in px (default 160 — intentionally tiny).
 */
export async function compressImage(
  source: HTMLImageElement | HTMLCanvasElement,
  crop: CropRect | null,
  maxSize = 160,
  quality = 0.5,
): Promise<Blob> {
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height

  const region: CropRect = crop ?? { x: 0, y: 0, width: sw, height: sh }

  // Scale so the longest edge of the cropped region == maxSize (never upscale)
  const scale = Math.min(1, maxSize / Math.max(region.width, region.height))
  const outW = Math.max(1, Math.round(region.width * scale))
  const outH = Math.max(1, Math.round(region.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    outW,
    outH,
  )

  const type = supportsWebp() ? 'image/webp' : 'image/jpeg'
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      type,
      quality,
    )
  })
}

let webpCache: boolean | null = null
function supportsWebp(): boolean {
  if (webpCache !== null) return webpCache
  const canvas = document.createElement('canvas')
  webpCache = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  return webpCache
}

export function fileToObjectUrl(file: File): string {
  return URL.createObjectURL(file)
}
