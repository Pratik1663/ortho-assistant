import { useRef } from 'react'
import type { OutgoingAttachment } from '../App'

const MAX_FILES = 3
const MAX_PDF_BYTES = 3 * 1024 * 1024 // 3 MB — serverless request limit safety
const IMAGE_MAX_DIMENSION = 1600

interface FileUploadButtonProps {
  disabled: boolean
  attachmentCount: number
  onAdd: (attachment: OutgoingAttachment) => void
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Read failed'))
    reader.readAsDataURL(file)
  })

// Downscale large photos in the browser so uploads stay small. Clinical photos
// keep plenty of detail at 1600px.
const downscaleImage = (dataUrl: string): Promise<{ data: string; mediaType: string }> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(
        1,
        IMAGE_MAX_DIMENSION / Math.max(img.width, img.height),
      )
      if (scale === 1 && dataUrl.length < 1_500_000) {
        const [meta, data] = dataUrl.split(',')
        const mediaType = meta.includes('image/png') ? 'image/png' : 'image/jpeg'
        resolve({ data, mediaType })
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Canvas unavailable'))
        return
      }
      context.drawImage(img, 0, 0, canvas.width, canvas.height)
      const jpeg = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ data: jpeg.split(',')[1], mediaType: 'image/jpeg' })
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })

export default function FileUploadButton({
  disabled,
  attachmentCount,
  onAdd,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }
    const remaining = MAX_FILES - attachmentCount
    if (remaining <= 0) {
      window.alert(`You can attach up to ${MAX_FILES} files per message.`)
      return
    }

    for (const file of Array.from(files).slice(0, remaining)) {
      try {
        const isPdf = file.type === 'application/pdf'
        const isImage = file.type === 'image/jpeg' || file.type === 'image/png'
        if (!isPdf && !isImage) {
          window.alert(`${file.name}: only JPG, PNG, and PDF files are supported.`)
          continue
        }
        if (isPdf && file.size > MAX_PDF_BYTES) {
          window.alert(`${file.name}: PDFs must be under 3 MB.`)
          continue
        }
        const dataUrl = await readAsDataUrl(file)
        if (isPdf) {
          onAdd({
            name: file.name,
            mediaType: 'application/pdf',
            data: dataUrl.split(',')[1],
          })
        } else {
          const { data, mediaType } = await downscaleImage(dataUrl)
          onAdd({ name: file.name, mediaType, data })
        }
      } catch (error) {
        console.error('Attachment failed:', error)
        window.alert(`${file.name} could not be attached. Please try again.`)
      }
    }
  }

  return (
    <>
      <input
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        hidden
        multiple
        onChange={(event) => {
          void handleFiles(event.target.files)
          event.target.value = ''
        }}
        ref={inputRef}
        type="file"
      />
      <button
        aria-label="Attach a file"
        className="composer-tool-btn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="Attach a photo or PDF"
        type="button"
      >
        📎
      </button>
    </>
  )
}
