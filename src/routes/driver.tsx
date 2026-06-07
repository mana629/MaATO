import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MapPin, Users, LogOut, Check, X, Shield, ToggleLeft, ToggleRight, Navigation, RefreshCw } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/lib/system-id";
import type { PassengerRequestPin } from "@/components/DriverMap";

const DriverMap = lazy(() =>
  import("@/components/DriverMap").then((m) => ({ default: m.DriverMap })),
);

export const Route = createFileRoute("/driver")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Driver Dashboard — MaATO" },
      { name: "description", content: "MaATO driver dashboard — go online, view passenger requests, and accept rides in real time." },
    ],
  }),
  component: DriverDashboard,
});

type Profile = { id: string; system_id: string; role: string };
type DriverProfile = { vehicle_number: string | null; is_online: boolean };

type ActiveRequest = {
  id: string;
  passenger_id: string;
  destination_label: string;
  passenger_count: number;
  status: "open" | "accepted" | "cancelled" | "completed";
  pickup_lat: number;
  pickup_lng: number;
  passenger_sid?: string;
};

function DriverDashboard() {
  const navigate = useNavigate();
  const { coords, error: geoError } = useGeolocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [activeTab, setActiveTab] = useState<"map" | "requests" | "profile">("requests");
  
  // Realtime requests list
  const [requests, setRequests] = useState<ActiveRequest[]>([]);
  // Current ride the driver accepted
  const [activeRide, setActiveRide] = useState<ActiveRequest | null>(null);
  const [loadingRide, setLoadingRide] = useState(true);

  // Bootstrap session + profile
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/auth", search: { role: "driver" } });
        return;
      }
      
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, system_id, role")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (mounted) {
        setProfile(prof as Profile | null);
      }

      // Fetch driver specific profile details
      const { data: drvProf } = await supabase
        .from("driver_profiles")
        .select("vehicle_number, is_online")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      if (mounted && drvProf) {
        setDriverProfile(drvProf as DriverProfile);
        setIsOnline(drvProf.is_online);
        setVehicleNumber(drvProf.vehicle_number || "");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth", search: { role: "driver" } });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  // Load active accepted ride & open requests
  useEffect(() => {
    if (!profile) return;
    
    // Load open requests
    const fetchRequests = async () => {
      const { data: openReqs } = await supabase
        .from("passenger_requests")
        .select("id, passenger_id, destination_label, passenger_count, pickup_lat, pickup_lng, status")
        .eq("status", "open");

      if (openReqs) {
        // Fetch passenger system IDs
        const passengerIds = Array.from(new Set(openReqs.map(r => r.passenger_id)));
        const { data: passengerProfiles } = await supabase
          .from("profiles")
          .select("id, system_id")
          .in("id", passengerIds);

        const idMap = new Map(passengerProfiles?.map(p => [p.id, p.system_id]) || []);

        const mapped: ActiveRequest[] = openReqs.map(r => ({
          id: r.id,
          passenger_id: r.passenger_id,
          destination_label: r.destination_label,
          passenger_count: r.passenger_count,
          pickup_lat: r.pickup_lat,
          pickup_lng: r.pickup_lng,
          status: r.status as any,
          passenger_sid: idMap.get(r.passenger_id) || "Passenger"
        }));
        setRequests(mapped);
      }
    };

    // Load active accepted ride
    const fetchActiveRide = async () => {
      setLoadingRide(true);
      const { data: ride } = await supabase
        .from("passenger_requests")
        .select("id, passenger_id, destination_label, passenger_count, pickup_lat, pickup_lng, status")
        .eq("accepted_by", profile.id)
        .eq("status", "accepted")
        .maybeSingle();

      if (ride) {
        const { data: passengerProf } = await supabase
          .from("profiles")
          .select("system_id")
          .eq("id", ride.passenger_id)
          .maybeSingle();

        setActiveRide({
          id: ride.id,
          passenger_id: ride.passenger_id,
          destination_label: ride.destination_label,
          passenger_count: ride.passenger_count,
          pickup_lat: ride.pickup_lat,
          pickup_lng: ride.pickup_lng,
          status: ride.status as any,
          passenger_sid: passengerProf?.system_id || "Passenger"
        });
      } else {
        setActiveRide(null);
      }
      setLoadingRide(false);
    };

    fetchRequests();
    fetchActiveRide();

    // Setup realtime subscription to passenger requests
    const ch = supabase
      .channel("live-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "passenger_requests" },
        async (payload) => {
          // Trigger a full reload of open requests to keep it simple and correct
          fetchRequests();
          
          // If our active accepted ride has been cancelled or completed elsewhere
          if (activeRide && payload.new && (payload.new as any).id === activeRide.id) {
            const updated = payload.new as any;
            if (updated.status !== "accepted") {
              setActiveRide(null);
              toast.info(`Ride was ${updated.status}`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile, activeRide?.id]);

  // Periodic location updates if online
  useEffect(() => {
    if (!isOnline || !profile || !coords) return;
    const interval = setInterval(async () => {
      await supabase
        .from("driver_profiles")
        .update({
          current_lat: coords[0],
          current_lng: coords[1],
          last_seen: new Date().toISOString(),
        })
        .eq("user_id", profile.id);
    }, 12000);

    return () => clearInterval(interval);
  }, [isOnline, profile, coords]);

  async function toggleOnline(online: boolean) {
    if (!profile) return;
    if (online && !coords) {
      toast.error("Need location access to go online!");
      return;
    }
    
    const { error } = await supabase
      .from("driver_profiles")
      .upsert({
        user_id: profile.id,
        is_online: online,
        current_lat: coords ? coords[0] : null,
        current_lng: coords ? coords[1] : null,
        vehicle_number: vehicleNumber || null,
        last_seen: new Date().toISOString(),
      });

    if (error) {
      toast.error(error.message);
      return;
    }

    setIsOnline(online);
    toast.success(online ? "You are online!" : "You are offline.");
  }

  async function updateVehicleNumber(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    const { error } = await supabase
      .from("driver_profiles")
      .update({ vehicle_number: vehicleNumber })
      .eq("user_id", profile.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Vehicle details updated");
    }
  }

  async function acceptRequest(reqId: string) {
    if (!profile) return;
    if (!isOnline) {
      toast.error("Go online first to accept requests!");
      return;
    }

    const { data, error } = await supabase
      .from("passenger_requests")
      .update({
        status: "accepted",
        accepted_by: profile.id,
      })
      .eq("id", reqId)
      .select()
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data) {
      toast.error("Request is no longer available.");
      return;
    }

    // Load active ride details
    const { data: passengerProf } = await supabase
      .from("profiles")
      .select("system_id")
      .eq("id", data.passenger_id)
      .maybeSingle();

    setActiveRide({
      id: data.id,
      passenger_id: data.passenger_id,
      destination_label: data.destination_label,
      passenger_count: data.passenger_count,
      pickup_lat: data.pickup_lat,
      pickup_lng: data.pickup_lng,
      status: "accepted",
      passenger_sid: passengerProf?.system_id || "Passenger"
    });
    
    setActiveTab("map");
    toast.success("Ride accepted! Check map for passenger location.");
  }

  async function cancelRide() {
    if (!activeRide) return;
    const { error } = await supabase
      .from("passenger_requests")
      .update({
        status: "open",
        accepted_by: null,
      })
      .eq("id", activeRide.id);

    if (error) {
      toast.error(error.message);
    } else {
      setActiveRide(null);
      toast("Ride cancelled");
    }
  }

  async function completeRide() {
    if (!activeRide) return;
    const { error } = await supabase
      .from("passenger_requests")
      .update({
        status: "completed",
      })
      .eq("id", activeRide.id);

    if (error) {
      toast.error(error.message);
    } else {
      setActiveRide(null);
      toast.success("Ride marked as completed!");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { role: "driver" } });
  }

  // Convert passenger request listings to Pins for DriverMap
  const mapPins: PassengerRequestPin[] = requests.map(r => ({
    id: r.id,
    lat: r.pickup_lat,
    lng: r.pickup_lng,
    destination_label: r.destination_label,
    passenger_count: r.passenger_count
  }));

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground font-sans flex flex-col justify-between select-none">
      
      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 bg-card/90 backdrop-blur-md border-b border-border flex justify-between items-center px-4 h-14">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>near_me</span>
          <h1 className="font-display text-xl font-bold text-primary">MaATO</h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold border-primary/30 text-primary">
            Driver
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <div className="privacy-mask-bg backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <span className="font-mono text-xs text-privacy-blue font-bold">{profile.system_id}</span>
              <span className="material-symbols-outlined text-privacy-blue text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative w-full pt-14 pb-20 overflow-hidden">
        
        {/* Map tab */}
        <div className={`absolute inset-0 ${activeTab === "map" ? "block" : "hidden"}`}>
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <DriverMap
              myLocation={coords}
              requests={mapPins}
              onSelectRequest={(req) => {
                const fullReq = requests.find(r => r.id === req.id);
                if (fullReq) {
                  acceptRequest(fullReq.id);
                }
              }}
            />
          </Suspense>

          {/* Map overlays */}
          {activeRide && (
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <Card className="max-w-md mx-auto p-4 bg-card/98 backdrop-blur shadow-lg border-border">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                      Active Ride
                    </span>
                    <span className="font-mono text-xs text-privacy-blue font-bold">
                      {activeRide.passenger_sid}
                    </span>
                  </div>
                  <Navigation className="h-4 w-4 text-primary animate-pulse" />
                </div>
                
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">location_on</span>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pickup</p>
                      <p className="font-semibold text-foreground">Nearby Current Location</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-muted-foreground text-[18px]">flag</span>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Destination</p>
                      <p className="font-semibold text-foreground">{activeRide.destination_label}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-10 text-muted-foreground" onClick={cancelRide}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-10 bg-primary text-white" onClick={completeRide}>
                    Mark Completed
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {!activeRide && isOnline && (
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <Card className="max-w-md mx-auto p-3 bg-card/95 backdrop-blur text-center shadow-md border-border">
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent animate-pulse"></span>
                  You are Online. Nearby passenger requests will show as markers.
                </p>
              </Card>
            </div>
          )}

          {!isOnline && (
            <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] pointer-events-none flex items-center justify-center p-4">
              <Card className="p-5 max-w-sm text-center shadow-lg border-border pointer-events-auto bg-card">
                <h3 className="font-display font-bold text-lg mb-2">You are Offline</h3>
                <p className="text-sm text-muted-foreground mb-4">Go online from the Profile tab to view nearby passengers and accept rides.</p>
                <Button className="w-full bg-primary text-white" onClick={() => toggleOnline(true)}>
                  Go Online
                </Button>
              </Card>
            </div>
          )}
        </div>

        {/* Requests Tab */}
        <div className={`absolute inset-0 overflow-y-auto px-4 py-4 ${activeTab === "requests" ? "block" : "hidden"}`}>
          <div className="max-w-md mx-auto space-y-4">
            
            {/* Online Status Quick Card */}
            <Card className="p-4 border-border flex items-center justify-between shadow-sm bg-card">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${isOnline ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
                <div>
                  <h3 className="font-semibold text-sm">{isOnline ? "Online & Active" : "Offline"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isOnline ? "Receiving live passenger requests" : "Go online to start receiving rides"}
                  </p>
                </div>
              </div>
              <Button 
                variant={isOnline ? "destructive" : "default"} 
                size="sm" 
                onClick={() => toggleOnline(!isOnline)}
                className="font-semibold shadow-sm"
              >
                {isOnline ? "Go Offline" : "Go Online"}
              </Button>
            </Card>

            <div className="flex justify-between items-center mb-2">
              <h2 className="font-display font-semibold text-lg">Live Ride Requests</h2>
              <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {requests.length} Nearby
              </span>
            </div>

            {/* Active accepted ride banner in feed */}
            {activeRide && (
              <Card className="bg-primary/5 border border-primary p-4 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Your Active Ride</span>
                    <span className="font-mono text-xs text-privacy-blue font-bold">{activeRide.passenger_sid}</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => setActiveTab("map")}>
                    <Navigation className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Heading to <span className="font-semibold text-foreground">{activeRide.destination_label}</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 h-9" onClick={cancelRide}>
                    Cancel Ride
                  </Button>
                  <Button size="sm" className="flex-1 bg-primary text-white h-9" onClick={completeRide}>
                    Mark Completed
                  </Button>
                </div>
              </Card>
            )}

            {/* Requests feed list */}
            {requests.length === 0 ? (
              <Card className="p-8 text-center border-border shadow-sm bg-card">
                <Users className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
                <h3 className="font-semibold text-base mb-1">No requests nearby</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isOnline 
                    ? "Passenger broadcasts will automatically show here in real-time."
                    : "Go online to scan the area for passenger broadcasts."
                  }
                </p>
              </Card>
            ) : (
              requests.map((req) => {
                const distance = coords 
                  ? haversineKm(coords[0], coords[1], req.pickup_lat, req.pickup_lng)
                  : null;

                return (
                  <Card key={req.id} className="border-border bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                          <span className="font-mono text-xs text-privacy-blue font-bold">{req.passenger_sid}</span>
                        </div>
                        {distance !== null && (
                          <div className="flex items-center gap-1 text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-semibold">
                            <span className="material-symbols-outlined text-[12px]">distance</span>
                            {distance.toFixed(1)} km
                          </div>
                        )}
                      </div>

                      <div className="space-y-2.5 mb-4 text-sm">
                        <div className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-primary mt-0.5 text-[18px]">near_me</span>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pickup Location</p>
                            <p className="font-semibold text-foreground">Nearby Current Location</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-muted-foreground mt-0.5 text-[18px]">flag</span>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Destination</p>
                            <p className="font-semibold text-foreground">{req.destination_label}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-muted-foreground mt-0.5 text-[18px]">group</span>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Passengers</p>
                            <p className="font-semibold text-foreground">{req.passenger_count} {req.passenger_count === 1 ? "person" : "people"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-10 text-muted-foreground"
                          onClick={() => {
                            setActiveTab("map");
                            // Recenter map or view coordinates
                          }}
                        >
                          Show on Map
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-10 bg-primary text-white shadow-sm"
                          onClick={() => acceptRequest(req.id)}
                          disabled={!!activeRide}
                        >
                          Accept Ride
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Profile Tab */}
        <div className={`absolute inset-0 overflow-y-auto px-4 py-4 ${activeTab === "profile" ? "block" : "hidden"}`}>
          <div className="max-w-md mx-auto space-y-4">
            
            {/* Driver Identity Card */}
            <Card className="p-5 border-border shadow-sm text-center bg-card">
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center text-3xl font-bold mb-3">
                🛺
              </div>
              <h2 className="font-display font-bold text-lg mb-1">MaATO Driver</h2>
              {profile && (
                <div className="privacy-mask-bg backdrop-blur-md px-3 py-1.5 rounded-full inline-flex items-center gap-2 mb-4 mx-auto shadow-sm">
                  <span className="font-mono text-sm text-privacy-blue font-bold">{profile.system_id}</span>
                  <span className="material-symbols-outlined text-privacy-blue text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your profile is completely anonymous. Passengers only see your system ID and current location on their maps.
              </p>
            </Card>

            {/* Vehicle details form */}
            <Card className="p-4 border-border shadow-sm bg-card">
              <form onSubmit={updateVehicleNumber} className="space-y-4">
                <h3 className="font-semibold text-sm">Vehicle Details</h3>
                <div className="space-y-1">
                  <Label htmlFor="vehicle_number" className="text-xs text-muted-foreground uppercase font-bold">Auto Rickshaw Number</Label>
                  <Input
                    id="vehicle_number"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g. WB-38-AB-1234"
                    className="border-border bg-muted/20 text-foreground rounded-lg h-11"
                  />
                </div>
                <Button type="submit" className="w-full bg-primary text-white h-11">
                  Save Vehicle Details
                </Button>
              </form>
            </Card>

            {/* Actions Card */}
            <Card className="p-4 border-border shadow-sm bg-card space-y-2">
              <Button variant="outline" className="w-full justify-between h-11 text-destructive hover:text-destructive hover:bg-destructive/5" onClick={signOut}>
                <span>Sign Out</span>
                <LogOut className="h-4 w-4" />
              </Button>
            </Card>
          </div>
        </div>

      </main>

      {/* Bottom Tab Navigation Bar */}
      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center h-16 bg-card border-t border-border shadow-md pb-safe">
        <button 
          onClick={() => setActiveTab("map")}
          className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === "map" ? "text-primary font-bold" : "text-muted-foreground"}`}
        >
          <span className="material-symbols-outlined text-[24px]">explore</span>
          <span className="text-[10px] tracking-wide mt-0.5">Map</span>
        </button>

        <button 
          onClick={() => setActiveTab("requests")}
          className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === "requests" ? "text-primary font-bold" : "text-muted-foreground"}`}
        >
          <span className="material-symbols-outlined text-[24px]">hail</span>
          <span className="text-[10px] tracking-wide mt-0.5">Requests</span>
        </button>

        <button 
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center justify-center w-20 h-full transition-colors ${activeTab === "profile" ? "text-primary font-bold" : "text-muted-foreground"}`}
        >
          <span className="material-symbols-outlined text-[24px]">person</span>
          <span className="text-[10px] tracking-wide mt-0.5">Profile</span>
        </button>
      </nav>
      
    </div>
  );
}
