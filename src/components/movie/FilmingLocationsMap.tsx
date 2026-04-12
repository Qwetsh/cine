import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { FilmingLocation } from './FilmingLocations'

// Fix default marker icons (Leaflet + bundler issue)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const narrativeIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'narrative-marker',
})

function FitBounds({ locations }: { locations: FilmingLocation[] }) {
  const map = useMap()

  useEffect(() => {
    if (locations.length === 0) return
    const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng]))
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 })
  }, [map, locations])

  return null
}

interface Props {
  locations: FilmingLocation[]
}

export default function FilmingLocationsMap({ locations }: Props) {
  if (locations.length === 0) return null

  const center: [number, number] = [locations[0].lat, locations[0].lng]

  return (
    <>
      <style>{`.narrative-marker { filter: hue-rotate(200deg) opacity(0.7); }`}</style>
      <MapContainer
        center={center}
        zoom={3}
        className="w-full h-full min-h-[300px]"
        scrollWheelZoom={true}
        style={{ background: '#1a1a2e' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds locations={locations} />
        {locations.map((loc, i) => (
          <Marker
            key={i}
            position={[loc.lat, loc.lng]}
            icon={loc.type === 'narrative' ? narrativeIcon : new L.Icon.Default()}
          >
            <Popup>
              <div style={{ color: '#1a1a2e' }}>
                <span style={{ fontWeight: 500 }}>{loc.name}</span>
                <br />
                <span style={{ fontSize: '11px', opacity: 0.7 }}>
                  {loc.type === 'filming' ? '🎬 Lieu de tournage' : '🎭 Lieu narratif'}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  )
}
