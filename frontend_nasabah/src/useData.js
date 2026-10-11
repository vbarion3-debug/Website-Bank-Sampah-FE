import { useCallback, useEffect, useState } from 'react'

// Hook kecil untuk memuat data async. `loader` harus fungsi yang stabil (didefinisikan di luar komponen).
export function useData(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const data = await loader()
      setState({ data, loading: false, error: '' })
    } catch (err) {
      setState((s) => ({
        data: s.data,
        loading: false,
        error: err.message || 'Gagal memuat data.',
      }))
    }
  }, [loader])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}
