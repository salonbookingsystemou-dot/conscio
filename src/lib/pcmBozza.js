// Audio di un paragrafo, così com’è in memoria: Int16 mono little-endian.
// In archivio si comprime con gzip. Senza CompressionStream resta il PCM grezzo.

export async function comprimiPcm(pcm) {
  const grezzo = byteDaPcm(pcm)
  if (!grezzo) return null
  if (typeof CompressionStream === 'undefined') return { bytes: grezzo, formato: 'pcm' }
  const flusso = new Blob([grezzo]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(flusso).arrayBuffer()
  return { bytes: new Uint8Array(buf), formato: 'gzip' }
}

export async function decomprimiPcm(bytes, formato) {
  if (!bytes?.byteLength) return null
  let grezzo = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (formato === 'gzip') {
    if (typeof DecompressionStream === 'undefined') return null
    const flusso = new Blob([grezzo]).stream().pipeThrough(new DecompressionStream('gzip'))
    const buf = await new Response(flusso).arrayBuffer()
    grezzo = new Uint8Array(buf)
  }
  return pcmDaByte(grezzo)
}

function byteDaPcm(pcm) {
  if (!pcm?.length) return null
  const copia = new Uint8Array(pcm.byteLength)
  copia.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))
  return copia
}

function pcmDaByte(bytes) {
  const n = bytes.byteLength - (bytes.byteLength % 2)
  if (n < 2) return null
  const copia = new Uint8Array(n)
  copia.set(bytes.subarray(0, n))
  return new Int16Array(copia.buffer)
}
