import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { ASANSOL_CENTER, DEFAULT_ZOOM } from "@/lib/system-id";

export type DriverPin = { user_id: string; lat: number; lng: number; accepted?: boolean };

const driverIcon = (accepted = false) =>
  L.divIcon({
    className: "",
    html: `<div class="al-driver-pin${accepted ? " accepted" : ""}">🛺</div>`,
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

export function PassengerMap({
  myLocation,
  drivers,
  pickup,
  acceptedDriverId,
}: {
  myLocation: [number, number] | null;
  drivers: DriverPin[];
  pickup: [number, number] | null;
  acceptedDriverId?: string | null;
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
      {drivers.map((d) => (
        <Marker
          key={d.user_id}
          position={[d.lat, d.lng]}
          icon={driverIcon(d.user_id === acceptedDriverId)}
        />
      ))}
      {pickup && <Marker position={pickup} icon={passengerIcon} />}
    </MapContainer>
  );
}
