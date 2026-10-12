/** MP4 verticale più vicino a 1080 px di larghezza, mai il 4K. */

export function scegliFileVideo(files) {
  const mp4 = files.filter((f) => {
    const larghezza = f.width ?? 0
    const altezza = f.height ?? 0
    const link = f.link || ''
    return f.file_type === 'video/mp4'
      && larghezza > 0
      && altezza > 0
      && larghezza <= 1920
      && link.startsWith('https://')
      && !link.includes('.m3u8')
  })
  const verticali = mp4.filter((f) => (f.height ?? 0) > (f.width ?? 0))
  const pool = verticali.length > 0 ? verticali : mp4
  pool.sort((a, b) => {
    const da = Math.abs((a.width ?? 0) - 1080)
    const db = Math.abs((b.width ?? 0) - 1080)
    if (da !== db) return da - db
    return (a.width ?? 0) - (b.width ?? 0)
  })
  return pool[0] ?? null
}
