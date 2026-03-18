'use client'

import { useEffect, useState, useRef } from 'react'
import type { StopData, TrackingData } from '@/types'

interface LiveMapProps {
  stops: StopData[]
  tracking?: TrackingData | null
  height?: string
  showRoute?: boolean
  center?: [number, number]
  zoom?: number
}

export default function LiveMap({
  stops,
  tracking,
  height = '400px',
  showRoute = true,
  center,
  zoom = 6,
}: LiveMapProps) {
  const mapRef = useRef<any>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const L = require('leaflet')

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
    }

    const defaultCenter = center || (stops.length > 0
      ? [stops.reduce((s, st) => s + st.latitude, 0) / stops.length, stops.reduce((s, st) => s + st.longitude, 0) / stops.length] as [number, number]
      : [47.0, 20.0] as [number, number])

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CartoDB',
      maxZoom: 19,
    }).addTo(map)

    // Add route polyline
    if (showRoute && stops.length > 1) {
      const coords = stops.sort((a, b) => a.orderIndex - b.orderIndex).map(s => [s.latitude, s.longitude])
      L.polyline(coords, {
        color: '#3B82F6',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10',
      }).addTo(map)
    }

    // Add stop markers
    stops.forEach(stop => {
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;background:#3B82F6;border:2px solid #1e293b;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: '',
      })

      L.marker([stop.latitude, stop.longitude], { icon })
        .bindPopup(`<b style="color:#e2e8f0">${stop.name}</b>`)
        .addTo(map)
    })

    // Add bus position marker
    if (tracking?.isActive) {
      const busIcon = L.divIcon({
        html: `<div style="width:24px;height:24px;background:#10B981;border:3px solid #1e293b;border-radius:50%;box-shadow:0 0 12px rgba(16,185,129,0.6);display:flex;align-items:center;justify-content:center;font-size:12px;">🚌</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: '',
      })

      markerRef.current = L.marker([tracking.latitude, tracking.longitude], { icon: busIcon })
        .bindPopup(`<b style="color:#e2e8f0">Bus in transit</b><br/><span style="color:#94a3b8">Speed: ${tracking.speed} km/h</span>`)
        .addTo(map)
    }

    // Fit bounds to show all markers
    if (stops.length > 1) {
      const bounds = L.latLngBounds(stops.map(s => [s.latitude, s.longitude]))
      if (tracking?.isActive) {
        bounds.extend([tracking.latitude, tracking.longitude])
      }
      map.fitBounds(bounds, { padding: [30, 30] })
    }

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [mounted, stops, showRoute, center, zoom])

  // Update bus position without recreating map
  useEffect(() => {
    if (!mapInstanceRef.current || !tracking?.isActive || !markerRef.current) return
    markerRef.current.setLatLng([tracking.latitude, tracking.longitude])
  }, [tracking?.latitude, tracking?.longitude])

  if (!mounted) {
    return (
      <div style={{ height }} className="glass-card flex items-center justify-center">
        <div className="text-dark-400">Loading map...</div>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="rounded-xl overflow-hidden border border-dark-700/50"
    />
  )
}
