import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Users } from "lucide-react";
import * as React from "react";
import { ScrollAnimationBackground } from "@/components/ScrollAnimationBackground";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MaATO — Live shared auto-rickshaws" },
      {
        name: "description",
        content:
          "MaATO is a privacy-first, real-time visibility network for shared auto-rickshaws in Indian cities. Find autos. Be found. No phone numbers shared.",
      },
      { property: "og:title", content: "MaATO — Live shared auto-rickshaws" },
      {
        property: "og:description",
        content: "Find and broadcast for shared autos in real time. No phone numbers shared.",
      },
    ],
  }),
  component: Landing,
});

function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer rounded square border */}
      <rect x="6" y="6" width="88" height="88" rx="22" stroke="currentColor" strokeWidth="4.5" />
      
      {/* Stylized M and A monogram */}
      {/* Left vertical */}
      <line x1="28" y1="30" x2="28" y2="70" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      
      {/* Right vertical */}
      <line x1="72" y1="30" x2="72" y2="70" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      
      {/* M-diagonals */}
      <line x1="28" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="72" y1="30" x2="50" y2="70" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      
      {/* A-legs */}
      <line x1="28" y1="70" x2="50" y2="30" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="72" y1="70" x2="50" y2="30" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      
      {/* A crossbar */}
      <line x1="38" y1="50" x2="62" y2="50" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans antialiased flex flex-col justify-between relative overflow-hidden">
      <ScrollAnimationBackground />
      {/* Header */}
      <header className="max-w-5xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3 font-medium text-lg text-primary tracking-wide">
          <Logo className="h-8 w-8 text-primary" />
          <span className="font-display text-2xl font-semibold">MaATO</span>
        </div>
        <Link 
          to="/auth" 
          className="text-xs font-bold uppercase tracking-[0.2em] text-primary hover:text-primary/80 transition-colors"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-3xl w-full mx-auto px-6 pt-12 pb-8 text-center flex flex-col items-center">
        {/* Large Logo in Center */}
        <div className="mb-10 text-primary flex justify-center">
          <Logo className="h-32 w-32 md:h-36 md:w-36 text-primary" />
        </div>

        {/* Location pill */}
        <span className="inline-block text-[10px] font-bold uppercase tracking-[0.25em] text-primary border border-primary/40 px-5 py-2 rounded-full bg-primary/5">
          Asansol · West Bengal · All India
        </span>

        {/* Title */}
        <h1 className="mt-8 text-6xl md:text-7xl font-display tracking-wide text-primary font-semibold">
          MaATO
        </h1>
        
        {/* Underline */}
        <div className="mt-5 w-16 h-[1.5px] bg-primary/60 mx-auto"></div>

        {/* Subtitle */}
        <p className="mt-8 text-muted-foreground text-lg md:text-xl font-light leading-relaxed max-w-xl">
          Every shared auto in your city, in real time. Privacy-first.{" "}
          <span className="text-foreground font-bold">No phone numbers shared.</span>
        </p>
      </section>

      {/* Role chooser */}
      <section className="max-w-4xl w-full mx-auto px-6 pb-20">
        <h2 className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 mb-8">
          Choose your role
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <RoleCard
            to="/passenger"
            icon={<Users className="h-6 w-6" />}
            title="I'm a Passenger"
            description="Find a nearby auto and broadcast where you're going."
            cta="Open passenger app"
          />
          <RoleCard
            to="/driver"
            icon={<MapPin className="h-6 w-6" />}
            title="I'm an Auto driver"
            description="Go online and accept passengers heading your way."
            cta="Open driver app"
          />
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          You'll be identified by a system ID like{" "}
          <span className="font-mono text-primary font-bold">USR-4K2M</span> — never your phone number.
        </p>
      </section>

      <footer className="border-t border-border bg-muted/20">
        <div className="max-w-5xl w-full mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>MaATO · privacy-first transport visibility</span>
          <span>Built for Indian cities</span>
        </div>
      </footer>
    </main>
  );
}

function RoleCard({
  to, icon, title, description, cta,
}: {
  to: "/passenger" | "/driver";
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}) {
  const role = to === "/passenger" ? "passenger" : "driver";
  return (
    <Link
      to="/auth"
      search={{ role }}
      className="group block rounded-[1.5rem] border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-300 p-8 relative overflow-hidden"
    >
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl border border-primary/25 text-primary bg-primary/5 mb-6 group-hover:scale-105 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-2xl md:text-3xl font-display tracking-wide text-foreground group-hover:text-primary transition-colors duration-300">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed font-light">{description}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary group-hover:gap-3 transition-all duration-300">
        {cta} <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
