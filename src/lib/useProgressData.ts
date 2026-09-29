import { listDailyLogs, listMeasurements, listMeasurementTypes } from './api'
import { useAsync } from './useAsync'

export function useProgressData(clientId: string) {
  return useAsync(async () => {
    const [logs, types, measurements] = await Promise.all([
      listDailyLogs(clientId),
      listMeasurementTypes(clientId),
      listMeasurements(clientId),
    ])
    return { logs, types, measurements }
  }, [clientId])
}

export type ProgressData = NonNullable<ReturnType<typeof useProgressData>['data']>
