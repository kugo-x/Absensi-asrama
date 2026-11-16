import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Crosshair } from 'lucide-react'
import { getCurrentPosition } from '../geo'

// Default center: Kampus Limau Manis, Universitas Andalas
const DEFAULT_LAT = -0.914488
const DEFAULT_LNG = 100.466542

export interface MapPickerProps {
  latitude: number | null
  longitude: number | null
  radiusMeter: number
  onChange: (lat: number, lng: number) => void
  onRadiusChange?: (radius: number) => void
  height?: string
  interactive?: boolean
  title?: string
}

// Marker icon menggunakan SVG Pin modern dan tajam
const createCustomPin = (color: string = '#047857') => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%);">
        <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3));">
          <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27.5 17 42 17 42C17 42 34 27.5 34 17C34 7.61116 26.3888 0 17 0Z" fill="${color}"/>
          <circle cx="17" cy="17" r="7" fill="white"/>
          <circle cx="17" cy="17" r="4" fill="${color}"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

export default function MapPicker({
  latitude,
  longitude,
  radiusMeter,
  onChange,
  onRadiusChange,
  height = '320px',
  interactive = true,
  title,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const [locating, setLocating] = useState(false)
  const [locMsg, setLocMsg] = useState<string | null>(null)

  const activeLat = latitude !== null && !isNaN(latitude) ? latitude : DEFAULT_LAT
  const activeLng = longitude !== null && !isNaN(longitude) ? longitude : DEFAULT_LNG

  // Inisialisasi peta
  useEffect(() => {
    if (!mapContainerRef.current) return

    // Cegah double init pada React StrictMode
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(mapContainerRef.current, {
      center: [activeLat, activeLng],
      zoom: 17,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([activeLat, activeLng], {
      icon: createCustomPin('#047857'),
      draggable: interactive,
    }).addTo(map)

    const circle = L.circle([activeLat, activeLng], {
      radius: radiusMeter,
      color: '#059669',
      fillColor: '#10b981',
      fillOpacity: 0.22,
      weight: 2,
    }).addTo(map)

    if (interactive) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng
        marker.setLatLng([lat, lng])
        circle.setLatLng([lat, lng])
        onChange(Number(lat.toFixed(8)), Number(lng.toFixed(8)))
      })

      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        circle.setLatLng(pos)
        onChange(Number(pos.lat.toFixed(8)), Number(pos.lng.toFixed(8)))
      })
    }

    mapInstanceRef.current = map
    markerRef.current = marker
    circleRef.current = circle

    // Trigger resize setelah dom render
    const t = setTimeout(() => {
      map.invalidateSize()
    }, 200)

    return () => {
      clearTimeout(t)
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
  }, [])

  // Update posisi saat props latitude/longitude berubah dari luar
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return
    if (latitude === null || longitude === null) return

    const currentPos = markerRef.current.getLatLng()
    if (Math.abs(currentPos.lat - latitude) > 0.000001 || Math.abs(currentPos.lng - longitude) > 0.000001) {
      markerRef.current.setLatLng([latitude, longitude])
      circleRef.current.setLatLng([latitude, longitude])
      mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom(), { animate: true })
    }
  }, [latitude, longitude])

  // Update radius lingkaran saat radiusMeter berubah
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radiusMeter)
    }
  }, [radiusMeter])

  const handleUseMyLocation = async () => {
    setLocating(true)
    setLocMsg(null)
    try {
      const pos = await getCurrentPosition()
      const lat = Number(pos.latitude.toFixed(8))
      const lng = Number(pos.longitude.toFixed(8))
      onChange(lat, lng)

      if (mapInstanceRef.current && markerRef.current && circleRef.current) {
        markerRef.current.setLatLng([lat, lng])
        circleRef.current.setLatLng([lat, lng])
        mapInstanceRef.current.setView([lat, lng], 18, { animate: true })
      }
      setLocMsg(`Lokasi terbaca (akurasi ±${Math.round(pos.accuracy)} m)`)
    } catch (err) {
      setLocMsg((err as Error).message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="rounded-xl border border-emerald-100/90 overflow-hidden bg-white shadow-xs">
      {title && (
        <div className="px-3.5 py-2.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
            {title}
          </span>
          {interactive && (
            <span className="text-[11px] text-emerald-800/80">Klik atau geser pin untuk menentukan titik</span>
          )}
        </div>
      )}

      <div className="relative">
        <div ref={mapContainerRef} style={{ width: '100%', height }} className="z-0" />

        {interactive && (
          <div className="absolute top-2.5 right-2.5 z-[1000]">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="bg-white/95 hover:bg-white text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-md border border-emerald-200/80 flex items-center gap-1.5 cursor-pointer backdrop-blur-xs transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              <Crosshair className={`w-3.5 h-3.5 text-emerald-700 ${locating ? 'animate-spin' : ''}`} />
              <span>{locating ? 'Membaca GPS...' : 'Lokasi Saya'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50/80 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-gray-400 block text-[10px] font-semibold uppercase">Koordinat</span>
            <span className="mono font-semibold text-gray-800">
              {latitude !== null ? Number(latitude).toFixed(6) : '-'}, {longitude !== null ? Number(longitude).toFixed(6) : '-'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px] font-semibold uppercase">Radius Geofence</span>
            <span className="font-bold text-emerald-800">{radiusMeter} meter</span>
          </div>
        </div>

        {onRadiusChange && interactive && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[11px] font-medium">Ubah Radius:</span>
            <input
              type="range"
              min={10}
              max={300}
              step={5}
              value={radiusMeter}
              onChange={e => onRadiusChange(Number(e.target.value))}
              className="w-24 accent-emerald-700 cursor-pointer"
            />
            <span className="mono text-[11px] font-bold text-gray-700 w-8 text-right">{radiusMeter}m</span>
          </div>
        )}
      </div>

      {locMsg && (
        <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-[11px] font-medium border-t border-emerald-100">
          {locMsg}
        </div>
      )}
    </div>
  )
}
