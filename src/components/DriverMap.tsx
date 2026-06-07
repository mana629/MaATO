import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { ASANSOL_CENTER, DEFAULT_ZOOM } from "@/lib/system-id";

export type PassengerRequestPin = {
  id: string;
  lat: number;
  lng: number;
  destination_label: string;
  passenger_count: number;
};

const myDriverIcon = L.divIcon({
  className: "",
  html: `<div class="al-driver-pin accepted">🛺</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const passengerIcon = L.divIcon({
  className: "",
  html: `<div class="al-pulse-dot"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function Recenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  const did = useRef(false);
  useEffect(() => {
    if (center && !did.current) {
      map.setView(center, DEFAULT_ZOOM);
      did.current = true;
    }
  }, [center, map]);
  return null;
}

export function DriverMap({
  myLocation,
  requests,
  onSelectRequest,
}: {
  myLocation: [number, number] | null;
  requests: PassengerRequestPin[];
  onSelectRequest?: (req: PassengerRequestPin) => void;
}) {
  const center = useMemo<[number, number]>(
    () => myLocation ?? ASANSOL_CENTER,
    [myLocation],
  );

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      className="absolute inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={myLocation} />
      {myLocation && <Marker position={myLocation} icon={myDriverIcon} />}
      {requests.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat, r.lng]}
          icon={passengerIcon}
          eventHandlers={{
            click: () => {
              if (onSelectRequest) onSelectRequest(r);
            },
          }}
        />
      ))}
    </MapContainer>
  );
}
