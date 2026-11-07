export interface GpsPosition {
  latitude: number
  longitude: number
  accuracy: number
}

// Jarak dua koordinat dalam meter (rumus Haversine)
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function getCurrentPosition(): Promise<GpsPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Browser Anda tidak mendukung GPS / Geolocation.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Izin akses lokasi ditolak. Aktifkan izin lokasi pada browser Anda.'))
        else if (err.code === err.TIMEOUT) reject(new Error('Waktu membaca lokasi habis. Coba lagi di area terbuka.'))
        else reject(new Error('Lokasi tidak dapat dibaca. Pastikan GPS perangkat aktif.'))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}
