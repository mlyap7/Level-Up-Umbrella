import { Link } from 'react-router-dom'
import { useProfile } from '../../lib/auth'
import { useProgressData } from '../../lib/useProgressData'
import { ProgressPanel } from '../../components/ProgressPanel'
import { DailyLogCard } from '../../components/DailyLogCard'
import { MeasurementsCard } from '../../components/MeasurementsCard'
import { ErrorMsg, Loading } from '../../components/ui'
import { InstallCard } from '../../components/InstallCard'
import { PhotosPromo } from '../../components/PhotosPromo'
import { QuestionnairePromo } from '../../components/QuestionnairePromo'
import { RemindersCard } from '../../components/RemindersCard'

export function Dashboard() {
  const profile = useProfile()
  const { data, error, loading, reload } = useProgressData(profile.id)
  const firstName = profile.full_name.split(' ')[0]

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load your data.'} />

  return (
    <div className="stack">
      <h1>{firstName ? `Hey ${firstName}` : 'Your progress'}</h1>
      {profile.role === 'coach' && profile.onboarded_at === null && (
        <section className="promo-card" aria-label="Set up your journey">
          <span className="tour-icon" aria-hidden>🚀</span>
          <div className="grow">
            <h2 style={{ marginBottom: 4 }}>Set up your own journey</h2>
            <p className="small" style={{ margin: '0 0 10px' }}>Add your goal, height and starting numbers, the same 2-minute setup your clients do.</p>
            <Link to="/welcome" className="btn btn-sm">Start setup</Link>
          </div>
        </section>
      )}
      {profile.role !== 'coach' && <InstallCard />}
      {profile.remind_morning !== undefined && <RemindersCard />}
      {!profile.head_coach && <QuestionnairePromo clientId={profile.id} />}
      {data.measurements.length === 0 && (
        <section className="promo-card" aria-label="Starting measurements">
          <span className="tour-icon" aria-hidden>📏</span>
          <div className="grow">
            <h2 style={{ marginBottom: 4 }}>Add your starting measurements</h2>
            <p className="small" style={{ margin: 0 }}>Grab a tape measure and add your waist and hips in the Weekly measurements card. They show progress the scale can’t.</p>
          </div>
        </section>
      )}
      <div className="dashboard-grid">
        <div className="dashboard-forms stack">
          <DailyLogCard clientId={profile.id} logs={data.logs} weightUnit={profile.weight_unit} smartScale={Boolean(profile.has_smart_scale)} onSaved={reload} />
          <MeasurementsCard clientId={profile.id} types={data.types} measurements={data.measurements} lengthUnit={profile.length_unit} onSaved={reload} />
          <PhotosPromo profile={profile} />
        </div>
        <div className="dashboard-progress">
          <ProgressPanel data={data} weightUnit={profile.weight_unit} lengthUnit={profile.length_unit} editable showBodyStats={Boolean(profile.has_smart_scale)} onChanged={reload} />
        </div>
      </div>
    </div>
  )
}
