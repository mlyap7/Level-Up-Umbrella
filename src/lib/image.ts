// Shrinks a photo on the phone before upload: max 1280px on the long side,
// JPEG at ~80% quality. A 4 MB phone photo becomes roughly 150-300 KB, which
// keeps uploads fast on mobile data and storage use low.
const MAX_SIDE = 1280
const QUALITY = 0.8

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through to <img> decoding (older Safari, unusual formats).
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressPhoto(file: Blob): Promise<Blob> {
  const img = await decode(file)
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t process photos. Try Safari or Chrome.')
  ctx.fillStyle = '#FFFFFF' // JPEG has no transparency: fill instead of turning black
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  if ('close' in img) img.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('Could not process that photo. Try another one.')
  return blob
}
