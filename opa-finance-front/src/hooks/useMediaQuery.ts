import { useEffect, useState } from 'react'

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia(query)
    const updateMatch = () => setMatches(media.matches)

    updateMatch()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateMatch)
      return () => media.removeEventListener('change', updateMatch)
    }

    media.addListener(updateMatch)
    return () => media.removeListener(updateMatch)
  }, [query])

  return matches
}
