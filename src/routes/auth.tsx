import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

type Role = "passenger" | "driver";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { role: Role } => {
    const role = search.role === "driver" ? "driver" : "passenger";
    return { role };
  },
  head: () => ({
    meta: [
      { title: "Sign in — MaATO" },
      { name: "description", content: "Sign in to MaATO to find shared auto-rickshaws in real time." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

function destinationFor(role: Role) {
  return role === "driver" ? "/driver" : "/passenger";
}

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

function AuthPage() {
  const navigate = useNavigate();
  const { role } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      // Align profile role with chosen role, then redirect.
      await supabase
        .from("profiles")
        .update({ role })
        .eq("id", data.session.user.id);
      navigate({ to: destinationFor(role) });
    });
  }, [navigate, role]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: true, data: { role } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setPhase("otp");
    toast.success("Check your email for a 6-digit code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (data.user) {
      await supabase.from("profiles").update({ role }).eq("id", data.user.id);
    }
    setLoading(false);
    toast.success("Signed in");
    navigate({ to: destinationFor(role) });
  }

  const roleLabel = role === "driver" ? "Auto driver" : "Passenger";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#080705] text-[#eae6dd] font-sans antialiased">
      <Link to="/" className="mb-8 flex items-center gap-3 font-medium text-lg text-[#dfb76c] tracking-wide">
        <Logo className="h-10 w-10 text-[#dfb76c]" />
        <span className="font-serif text-3xl font-semibold">MaATO</span>
      </Link>
      <Card className="w-full max-w-sm p-8 border border-[#dfb76c]/15 bg-[#12110e] text-[#eae6dd] rounded-[2rem] shadow-2xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#dfb76c]">
          Signing in as {roleLabel}
        </div>
        <h1 className="text-2xl font-serif text-white tracking-wide mt-2">
          {phase === "email" ? "Sign in to MaATO" : "Enter your code"}
        </h1>
        <p className="text-sm text-[#eae6dd]/60 mt-1 font-light">
          {phase === "email"
            ? "We'll email you a one-time code. No password needed."
            : `Sent to ${email}`}
        </p>

        {phase === "email" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-[#eae6dd]/70 font-semibold tracking-wider uppercase">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[#1a1916] border-[#dfb76c]/15 text-[#eae6dd] focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c] rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full h-11 bg-[#dfb76c] hover:bg-[#cfa55c] text-[#080705] font-bold rounded-xl transition-all duration-300" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </Button>
            <Link
              to="/auth"
              search={{ role: role === "driver" ? "passenger" : "driver" }}
              className="block text-center text-xs text-[#dfb76c] hover:text-[#e8c887] font-semibold tracking-wider uppercase mt-4 transition-colors"
            >
              Switch to {role === "driver" ? "Passenger" : "Auto driver"}
            </Link>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-xs text-[#eae6dd]/70 font-semibold tracking-wider uppercase">6-digit code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.4em] bg-[#1a1916] border-[#dfb76c]/15 text-[#eae6dd] focus:border-[#dfb76c] focus:ring-1 focus:ring-[#dfb76c] rounded-xl"
                required
              />
            </div>
            <Button type="submit" className="w-full h-11 bg-[#dfb76c] hover:bg-[#cfa55c] text-[#080705] font-bold rounded-xl transition-all duration-300" disabled={loading}>
              {loading ? "Verifying…" : "Verify & continue"}
            </Button>
            <button
              type="button"
              onClick={() => setPhase("email")}
              className="text-xs text-[#eae6dd]/50 hover:text-[#eae6dd] w-full text-center mt-4 transition-colors"
            >
              Use a different email
            </button>
          </form>
        )}
      </Card>
      <p className="mt-6 text-xs text-[#eae6dd]/40 max-w-xs text-center leading-relaxed font-light font-sans">
        MaATO never shows your email or phone to drivers. You'll be identified only by a system ID like <span className="font-mono text-[#dfb76c] font-bold">USR-4K2M</span>.
      </p>
    </div>
  );
}
