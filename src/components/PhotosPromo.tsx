import { Link } from 'react-router-dom'
import { listPhotos } from '../lib/api'
import { toISODate, todayISO } from '../lib/dates'
import { photosDue } from '../lib/photos'
import type { Profile } from '../lib/types'
import { useAsync } from '../lib/useAsync'

/** "Photo week" reminder, or a quiet link to the photos page. */
export function PhotosPromo({ profile, compact = false }: { profile: Profile; compact?: boolean }) {
  // Before the photos database update runs, the table doesn't exist: show nothing.
  const { data } = useAsync(() => listPhotos(profile.id).catch(() => null), [profile.id])
  if (data === null || data === undefined) return null
  const start = profile.coaching_started_on ?? toISODate(new Date(profile.created_at))
  const due = photosDue(start, todayISO(), data)

  if (due) {
    return (
      <section className="promo-card" aria-label="Photo week">
        <span className="tour-icon" aria-hidden>📸</span>
        <div className="grow">
          <h2 style={{ marginBottom: 4 }}>Photo week!</h2>
          <p className="small" style={{ margin: '0 0 10px' }}>Add your front, side and back photos. It takes 2 minutes and they show progress the scale can’t.</p>
          <Link to="/photos" className="btn btn-sm">Add photos</Link>
        </div>
      </section>
    )
  }
  if (compact) return null
  return (
    <Link to="/photos" className="card photos-link">
      <span className="tour-icon" aria-hidden>📸</span>
      <span className="grow"><strong>Progress photos</strong><span className="small muted" style={{ display: 'block' }}>{data.length ? 'View, add and compare' : 'Add your first set'}</span></span>
      <span aria-hidden>›</span>
    </Link>
  )
}
