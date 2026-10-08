import { useEffect, useMemo, useRef, useState } from 'react'
import { deletePhoto, listPhotos, photoUrls, savePhoto } from '../lib/api'
import { formatFullDate, todayISO } from '../lib/dates'
import { compressPhoto } from '../lib/image'
import { photoSets, POSES } from '../lib/photos'
import type { Pose, ProgressPhoto } from '../lib/types'
import { useAsync } from '../lib/useAsync'
import { Card, ErrorMsg, Loading } from './ui'

/** Progress photos for one client. `editable` = the client's own view. */
export function PhotosView({ clientId, editable }: { clientId: string; editable: boolean; startedOn?: string | null }) {
  const { data, error, loading, reload } = useAsync(async () => {
    const photos = await listPhotos(clientId)
    const urls = await photoUrls(photos.map((p) => p.storage_path))
    return { photos, urls }
  }, [clientId])
  const [viewing, setViewing] = useState<{ url: string; caption: string } | null>(null)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load photos.'} />

  const sets = photoSets(data.photos)
  const open = (p: ProgressPhoto) => {
    const url = data.urls[p.storage_path]
    if (url) setViewing({ url, caption: `${POSES.find((x) => x.pose === p.pose)?.label} · ${formatFullDate(p.taken_on)}` })
  }

  return (
    <div className="stack">
      {editable && <UploadCard clientId={clientId} photos={data.photos} urls={data.urls} onSaved={reload} />}
      {sets.length >= 2 && <CompareCard photos={data.photos} urls={data.urls} />}
      <Card title="All photos">
        {sets.length === 0 ? (
          <div className="empty">{editable ? 'No photos yet. Your first set becomes your “before”.' : 'No photos yet.'}</div>
        ) : (
          <div className="stack-sm">
            {sets.map((set) => (
              <div key={set.date} className="list-item">
                <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>{formatFullDate(set.date)}</div>
                <div className="photo-row">
                  {POSES.map(({ pose, label }) => {
                    const p = set.byPose[pose]
                    return p && data.urls[p.storage_path] ? (
                      <button key={pose} type="button" className="photo-thumb" onClick={() => open(p)} aria-label={`${label}, ${formatFullDate(set.date)}`}>
                        <img src={data.urls[p.storage_path]} alt="" loading="lazy" />
                        <span>{label}</span>
                      </button>
                    ) : <div key={pose} className="photo-thumb empty-thumb"><span>{label}</span></div>
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {viewing && <Lightbox {...viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

function UploadCard({ clientId, photos, urls, onSaved }: {
  clientId: string; photos: ProgressPhoto[]; urls: Record<string, string>; onSaved: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const [busyPose, setBusyPose] = useState<Pose | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<Pose, HTMLInputElement | null>>>({})
  const onDate = useMemo(() => Object.fromEntries(photos.filter((p) => p.taken_on === date).map((p) => [p.pose, p])) as Partial<Record<Pose, ProgressPhoto>>, [photos, date])

  async function pick(pose: Pose, file: File | undefined) {
    if (!file) return
    setError(null)
    setBusyPose(pose)
    try {
      const small = await compressPhoto(file)
      await savePhoto(clientId, date, pose, small, onDate[pose])
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setBusyPose(null)
      const el = inputs.current[pose]
      if (el) el.value = ''
    }
  }

  return (
    <Card title="Add this round’s photos">
      <p className="small muted">Same spot, same lighting, same time of day (morning works best). Only you and your coach can see these.</p>
      <label className="field" style={{ maxWidth: 220, marginBottom: 12 }}>Date
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
      </label>
      <div className="photo-row upload">
        {POSES.map(({ pose, label, tip }) => {
          const existing = onDate[pose]
          const url = existing ? urls[existing.storage_path] : undefined
          return (
            <div key={pose} className="photo-slot">
              <button type="button" className={`photo-thumb ${url ? '' : 'empty-thumb add'}`} disabled={busyPose != null}
                onClick={() => inputs.current[pose]?.click()} aria-label={`${existing ? 'Replace' : 'Add'} ${label} photo`}>
                {url ? <img src={url} alt="" /> : <span className="plus" aria-hidden>{busyPose === pose ? '…' : '+'}</span>}
                <span>{busyPose === pose ? 'Uploading…' : label}</span>
              </button>
              <input ref={(el) => { inputs.current[pose] = el }} type="file" accept="image/*" hidden
                onChange={(e) => void pick(pose, e.target.files?.[0])} />
              <div className="photo-tip">{tip}</div>
              {existing && (
                <button type="button" className="link-btn small" onClick={async () => {
                  if (!confirm(`Delete this ${label.toLowerCase()} photo?`)) return
                  try { await deletePhoto(existing); onSaved() } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete.') }
                }}>Delete</button>
              )}
            </div>
          )
        })}
      </div>
      <ErrorMsg error={error} />
    </Card>
  )
}

function CompareCard({ photos, urls }: { photos: ProgressPhoto[]; urls: Record<string, string> }) {
  const dates = useMemo(() => [...new Set(photos.map((p) => p.taken_on))].sort(), [photos])
  const [pose, setPose] = useState<Pose>('front')
  const [before, setBefore] = useState(dates[0])
  const [after, setAfter] = useState(dates[dates.length - 1])
  useEffect(() => { setBefore(dates[0]); setAfter(dates[dates.length - 1]) }, [dates])

  const find = (d: string) => photos.find((p) => p.taken_on === d && p.pose === pose)
  const side = (label: string, d: string, set: (v: string) => void) => {
    const p = find(d)
    return (
      <div className="compare-side">
        <select value={d} onChange={(e) => set(e.target.value)} aria-label={`${label} date`}>
          {dates.map((x) => <option key={x} value={x}>{formatFullDate(x)}</option>)}
        </select>
        <div className="compare-img">
          {p && urls[p.storage_path] ? <img src={urls[p.storage_path]} alt={`${label}: ${pose} photo, ${formatFullDate(d)}`} /> : <span className="small muted">No {pose} photo that day</span>}
        </div>
        <div className="small" style={{ fontWeight: 600, textAlign: 'center' }}>{label}</div>
      </div>
    )
  }

  return (
    <Card title="Compare" action={
      <div className="segmented" role="group" aria-label="Pose">
        {POSES.map((x) => <button key={x.pose} type="button" aria-pressed={pose === x.pose} onClick={() => setPose(x.pose)}>{x.label}</button>)}
      </div>
    }>
      <div className="compare">
        {side('Before', before, setBefore)}
        {side('After', after, setAfter)}
      </div>
    </Card>
  )
}

function Lightbox({ url, caption, onClose }: { url: string; caption: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={caption} onClick={onClose}>
      <img src={url} alt={caption} />
      <div className="lightbox-caption">{caption} · tap to close</div>
    </div>
  )
}
