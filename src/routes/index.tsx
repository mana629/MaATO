import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Users } from "lucide-react";

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
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="text-2xl">🛺</span> AutoLink
        </div>
        <Link to="/auth">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-10 pb-6 text-center">
        <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-accent px-3 py-1 rounded-full">
          Asansol · West Bengal
        </span>
        <h1 className="mt-5 text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
          See every shared auto in your city, in real time.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Privacy-first visibility network. <strong className="text-foreground">No phone numbers shared.</strong>
        </p>
      </section>

      {/* Role chooser — the two big cards */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-center text-sm font-bold uppercase tracking-wider text-muted-foreground mb-5">
          Get started — choose your role
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <RoleCard
            to="/passenger"
            icon={<Users className="h-7 w-7" />}
            title="I'm a Passenger"
            description="Find a nearby auto and broadcast where you're going."
            cta="Open passenger app"
            tone="primary"
          />
          <RoleCard
            to="/driver"
            icon={<MapPin className="h-7 w-7" />}
            title="I'm an Auto driver"
            description="Go online and accept passengers heading your way."
            cta="Open driver app"
            tone="ink"
          />
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          You'll be identified by a system ID like{" "}
          <span className="font-mono text-foreground font-bold">USR-4K2M</span> — never your phone number.
        </p>
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

function RoleCard({
  to, icon, title, description, cta, tone,
}: {
  to: "/passenger" | "/driver";
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  tone: "primary" | "ink";
}) {
  const toneClasses =
    tone === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
      : "bg-foreground text-background hover:bg-foreground/90 border-foreground";
  return (
    <Link
      to={to}
      className="group block rounded-3xl border-2 bg-card hover:border-foreground/40 transition-colors p-6 shadow-[var(--shadow-elevated)]"
    >
      <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl ${toneClasses} border-2`}>
        {icon}
      </div>
      <h3 className="mt-4 text-2xl font-bold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-muted-foreground">{description}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 font-bold text-foreground group-hover:gap-2.5 transition-all">
        {cta} <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
