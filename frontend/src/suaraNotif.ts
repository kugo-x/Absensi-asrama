// Bunyi notifikasi singkat (dua nada) dengan Web Audio, tanpa berkas suara.
// Hanya dipakai untuk notifikasi penting; gagal diam-diam bila browser belum mengizinkan audio.
let ctx: AudioContext | null = null

export function bunyiNotifikasi() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    const mulai = ctx.currentTime
    ;[[880, 0], [1320, 0.14]].forEach(([frek, jeda]) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = frek
      gain.gain.setValueAtTime(0.0001, mulai + jeda)
      gain.gain.exponentialRampToValueAtTime(0.18, mulai + jeda + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, mulai + jeda + 0.32)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(mulai + jeda)
      osc.stop(mulai + jeda + 0.35)
    })
  } catch {
    // audio tidak tersedia: abaikan
  }
}
