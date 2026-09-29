import { useCallback, useEffect, useState } from 'react'

/** Runs an async loader on mount and whenever deps change; exposes reload(). */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  useEffect(() => {
    let active = true
    setLoading(true)
    run()
      .then((d) => {
        if (active) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [run, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data, error, loading, reload, setData }
}
