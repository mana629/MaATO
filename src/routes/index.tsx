import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AutoLink — Live shared auto-rickshaws" },
      {
        name: "description",
        content:
          "AutoLink is a privacy-first, real-time visibility network for shared auto-rickshaws in Indian cities. Find autos. Be found. No phone numbers shared.",
      },
      { property: "og:title", content: "AutoLink — Live shared auto-rickshaws" },
      {
        property: "og:description",
        content: "Find and broadcast for shared autos in real time. No phone numbers shared.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <span className="text-2xl">🛺</span> AutoLink
        </div>
        <Link to="/auth">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-12 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block text-xs font-medium uppercase tracking-wider text-primary bg-accent px-3 py-1 rounded-full">
            Asansol · West Bengal
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
            See every shared auto in your city, in real time.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-md">
            AutoLink is a live visibility network for shared auto-rickshaws. Broadcast where
            you're going, see who's nearby — without ever sharing your phone number.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/passenger">
              <Button size="lg" className="h-12 px-6 text-base">Open the map</Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                Sign in
              </Button>
            </Link>
          </div>
          <ul className="mt-10 space-y-2 text-sm text-muted-foreground">
            <li>· Live driver positions on an OpenStreetMap canvas</li>
            <li>· One-tap "Need Auto" broadcast to nearby drivers</li>
            <li>· Identity is a system ID like <span className="font-mono text-foreground">USR-4K2M</span> — never a phone number</li>
          </ul>
        </div>

        <div className="relative aspect-[4/5] rounded-3xl bg-card border shadow-[var(--shadow-elevated)] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.72_0.17_50/0.15),transparent_60%),radial-gradient(circle_at_70%_80%,oklch(0.55_0.16_240/0.15),transparent_55%)]" />
          <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-background/90 px-3 py-1.5 rounded-full text-xs font-medium">
              <span>🛺</span> AutoLink
            </div>
            <span className="text-[10px] font-mono bg-background/90 px-2 py-1 rounded-full">USR-4K2M</span>
          </div>
          <div className="absolute top-[30%] left-[20%] al-driver-pin">🛺</div>
          <div className="absolute top-[45%] left-[60%] al-driver-pin">🛺</div>
          <div className="absolute top-[60%] left-[35%] al-driver-pin accepted">🛺</div>
          <div className="absolute top-[63%] left-[40%] al-pulse-dot" />
          <div className="absolute bottom-5 left-5 right-5 bg-card border rounded-2xl p-4 shadow-lg">
            <p className="font-semibold text-sm">Driver on the way</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">DRV-9X3P</span> · 1.4 km away
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="max-w-5xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>AutoLink · privacy-first transport visibility</span>
          <span>Built for Indian cities</span>
        </div>
      </footer>
    </main>
  );
}
