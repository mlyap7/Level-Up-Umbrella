import { Link } from 'react-router-dom'
import { useProfile } from '../../lib/auth'
import { PhotosView } from '../../components/PhotosView'

export function PhotosPage() {
  const profile = useProfile()
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div>
        <Link to="/" className="small">← Progress</Link>
        <h1 style={{ marginTop: 4 }}>Progress photos</h1>
        <p className="small muted" style={{ margin: 0 }}>Every second week: front, side and back. 🔒 Private to you and your coach.</p>
      </div>
      <PhotosView clientId={profile.id} editable startedOn={profile.coaching_started_on ?? null} />
    </div>
  )
}
