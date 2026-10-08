import { useProfile } from '../../lib/auth'
import { useProgressData } from '../../lib/useProgressData'
import { ProgressPanel } from '../../components/ProgressPanel'
import { DailyLogCard } from '../../components/DailyLogCard'
import { MeasurementsCard } from '../../components/MeasurementsCard'
import { ErrorMsg, Loading } from '../../components/ui'
import { InstallCard } from '../../components/InstallCard'
import { PhotosPromo } from '../../components/PhotosPromo'

export function Dashboard() {
  const profile = useProfile()
  const { data, error, loading, reload } = useProgressData(profile.id)
  const firstName = profile.full_name.split(' ')[0]

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load your data.'} />

  return (
    <div className="stack">
      <h1>{firstName ? `Hey ${firstName}` : 'Your progress'}</h1>
      <InstallCard />
      <div className="dashboard-grid">
        <div className="dashboard-forms stack">
          <DailyLogCard clientId={profile.id} logs={data.logs} weightUnit={profile.weight_unit} onSaved={reload} />
          <MeasurementsCard clientId={profile.id} types={data.types} measurements={data.measurements} lengthUnit={profile.length_unit} onSaved={reload} />
          <PhotosPromo profile={profile} />
        </div>
        <div className="dashboard-progress">
          <ProgressPanel data={data} weightUnit={profile.weight_unit} lengthUnit={profile.length_unit} editable onChanged={reload} />
        </div>
      </div>
    </div>
  )
}
