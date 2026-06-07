import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MapPin, Minus, Plus, X, LogOut } from "lucide-react";
import type { DriverPin } from "@/components/PassengerMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/lib/system-id";

const PassengerMap = lazy(() =>
  import("@/components/PassengerMap").then((m) => ({ default: m.PassengerMap })),
);

export const Route = createFileRoute("/passenger")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Find an auto — MaATO" },
      { name: "description", content: "See nearby shared auto-rickshaws and broadcast your destination in real time." },
    ],
  }),
  component: PassengerApp,
});

type Profile = { id: string; system_id: string; role: string };
type ActiveRequest = {
  id: string;
  destination_label: string;
  passenger_count: number;
  status: "open" | "accepted" | "cancelled" | "completed";
  accepted_by: string | null;
  pickup_lat: number;
  pickup_lng: number;
};

function PassengerApp() {
  const navigate = useNavigate();
  const { coords, error: geoError } = useGeolocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [drivers, setDrivers] = useState<DriverPin[]>([]);
  const [destination, setDestination] = useState("");
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);
  const [acceptedDriverSid, setAcceptedDriverSid] = useState<string | null>(null);

  // Bootstrap session + profile
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/auth", search: { role: "passenger" } });
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, system_id, role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (mounted) setProfile(prof as Profile | null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth", search: { role: "passenger" } });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // Initial load of online drivers + my active request
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: ds } = await supabase
        .from("driver_profiles")
        .select("user_id, current_lat, current_lng, is_online")
        .eq("is_online", true);
      setDrivers(
        (ds ?? [])
          .filter((d) => d.current_lat != null && d.current_lng != null)
          .map((d) => ({ user_id: d.user_id, lat: d.current_lat!, lng: d.current_lng! })),
      );

      const { data: req } = await supabase
        .from("passenger_requests")
        .select("id, destination_label, passenger_count, status, accepted_by, pickup_lat, pickup_lng")
        .eq("passenger_id", profile.id)
        .in("status", ["open", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (req) setActiveRequest(req as ActiveRequest);
    })();
  }, [profile]);

  // Realtime driver positions
  useEffect(() => {
    const ch = supabase
      .channel("driver-positions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_profiles" },
        (payload) => {
          const row = payload.new as {
            user_id: string;
            current_lat: number | null;
            current_lng: number | null;
            is_online: boolean;
          };
          setDrivers((prev) => {
            const others = prev.filter((d) => d.user_id !== row.user_id);
            if (!row.is_online || row.current_lat == null || row.current_lng == null) return others;
            return [...others, { user_id: row.user_id, lat: row.current_lat, lng: row.current_lng }];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Realtime: my own request changes (accept/cancel)
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`req-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "passenger_requests", filter: `passenger_id=eq.${profile.id}` },
        (payload) => {
          const row = payload.new as ActiveRequest;
          if (row.status === "open" || row.status === "accepted") setActiveRequest(row);
          else setActiveRequest(null);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile]);

  // When accepted, fetch driver's system_id
  useEffect(() => {
    if (activeRequest?.status === "accepted" && activeRequest.accepted_by) {
      supabase
        .from("profiles")
        .select("system_id")
        .eq("id", activeRequest.accepted_by)
        .maybeSingle()
        .then(({ data }) => setAcceptedDriverSid(data?.system_id ?? null));
    } else {
      setAcceptedDriverSid(null);
    }
  }, [activeRequest?.status, activeRequest?.accepted_by]);

  async function createRequest() {
    if (!profile || !coords) {
      toast.error(geoError ?? "Waiting for your location…");
      return;
    }
    const dest = destination.trim();
    if (!dest) return toast.error("Where to?");
    if (dest.length > 120) return toast.error("Destination too long");
    setSubmitting(true);
    const { data, error } = await supabase
      .from("passenger_requests")
      .insert({
        passenger_id: profile.id,
        destination_label: dest,
        pickup_lat: coords[0],
        pickup_lng: coords[1],
        passenger_count: count,
      })
      .select("id, destination_label, passenger_count, status, accepted_by, pickup_lat, pickup_lng")
      .single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setActiveRequest(data as ActiveRequest);
    setDestination("");
    toast.success("Broadcasting to nearby drivers");
  }

  async function cancelRequest() {
    if (!activeRequest) return;
    const { error } = await supabase
      .from("passenger_requests")
      .update({ status: "cancelled" })
      .eq("id", activeRequest.id);
    if (error) return toast.error(error.message);
    setActiveRequest(null);
    toast("Request cancelled");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { role: "passenger" } });
  }

  const acceptedDriverPin = activeRequest?.accepted_by ?? null;
  const pickup: [number, number] | null = activeRequest
    ? [activeRequest.pickup_lat, activeRequest.pickup_lng]
    : coords;

  const acceptedDriver = drivers.find((d) => d.user_id === acceptedDriverPin);
  const distanceKm =
    acceptedDriver && pickup
      ? haversineKm(acceptedDriver.lat, acceptedDriver.lng, pickup[0], pickup[1])
      : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <PassengerMap
          myLocation={coords}
          drivers={drivers}
          pickup={pickup}
          acceptedDriverId={acceptedDriverPin}
        />
      </Suspense>

      {/* Top bar */}
      <header className="absolute top-0 left-0 right-0 z-10 p-3 pointer-events-none">
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 bg-card/95 backdrop-blur px-3 py-2 rounded-full shadow-[var(--shadow-elevated)] border border-border">
            <span className="text-xl">🛺</span>
            <span className="font-display font-semibold text-primary">MaATO</span>
            {profile && (
              <div className="privacy-mask-bg backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <span className="font-mono text-[11px] text-privacy-blue font-bold">{profile.system_id}</span>
                <span className="material-symbols-outlined text-privacy-blue text-[12px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={signOut}
            className="rounded-full shadow-[var(--shadow-elevated)] bg-card/95 border border-border text-foreground hover:bg-muted"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <Card className="max-w-md mx-auto p-4 shadow-[var(--shadow-panel)] border-0 bg-card/98 backdrop-blur">
          {!activeRequest ? (
            <NeedAutoPanel
              destination={destination}
              setDestination={setDestination}
              count={count}
              setCount={setCount}
              submitting={submitting}
              onSubmit={createRequest}
              ready={!!coords}
              driversNearby={drivers.length}
            />
          ) : activeRequest.status === "open" ? (
            <WaitingPanel
              destination={activeRequest.destination_label}
              count={activeRequest.passenger_count}
              onCancel={cancelRequest}
            />
          ) : (
            <AcceptedPanel
              driverSid={acceptedDriverSid}
              distanceKm={distanceKm}
              destination={activeRequest.destination_label}
              onCancel={cancelRequest}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function NeedAutoPanel(props: {
  destination: string;
  setDestination: (s: string) => void;
  count: number;
  setCount: (n: number) => void;
  submitting: boolean;
  onSubmit: () => void;
  ready: boolean;
  driversNearby: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Where to?</h2>
        <span className="text-xs text-muted-foreground">
          {props.driversNearby} {props.driversNearby === 1 ? "auto" : "autos"} nearby
        </span>
      </div>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={props.destination}
          onChange={(e) => props.setDestination(e.target.value)}
          placeholder="e.g. Burnpur Road"
          className="pl-9 h-11"
          maxLength={120}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Passengers</span>
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            onClick={() => props.setCount(Math.max(1, props.count - 1))}
            disabled={props.count <= 1}
            aria-label="Fewer passengers"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-6 text-center font-semibold tabular-nums">{props.count}</span>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            onClick={() => props.setCount(Math.min(6, props.count + 1))}
            disabled={props.count >= 6}
            aria-label="More passengers"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={props.onSubmit}
        disabled={!props.ready || props.submitting}
      >
        {props.submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : props.ready ? (
          "Need Auto"
        ) : (
          "Getting your location…"
        )}
      </Button>
    </div>
  );
}

function WaitingPanel({
  destination, count, onCancel,
}: { destination: string; count: number; onCancel: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="al-pulse-dot shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Waiting for a driver…</p>
          <p className="text-sm text-muted-foreground truncate">
            {destination} · {count} {count === 1 ? "passenger" : "passengers"}
          </p>
        </div>
      </div>
      <Button variant="outline" className="w-full" onClick={onCancel}>
        <X className="h-4 w-4 mr-2" /> Cancel request
      </Button>
    </div>
  );
}

function AcceptedPanel({
  driverSid, distanceKm, destination, onCancel,
}: {
  driverSid: string | null;
  distanceKm: number | null;
  destination: string;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[oklch(0.6_0.18_145)] grid place-items-center text-white text-lg shrink-0">
          🛺
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Driver on the way</p>
          <p className="text-sm text-muted-foreground truncate">
            <span className="font-mono">{driverSid ?? "DRV-—"}</span>
            {distanceKm != null && <> · {distanceKm.toFixed(1)} km away</>}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Heading to <span className="font-medium text-foreground">{destination}</span>
      </p>
      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
