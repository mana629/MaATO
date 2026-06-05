import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — AutoLink" },
      { name: "description", content: "Sign in to AutoLink to find shared auto-rickshaws in real time." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/passenger" });
    });
  }, [navigate]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { shouldCreateUser: true, data: { role: "passenger" } },
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
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    navigate({ to: "/passenger" });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <Link to="/" className="mb-8 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <span className="text-3xl">🛺</span> AutoLink
      </Link>
      <Card className="w-full max-w-sm p-6 shadow-[var(--shadow-elevated)]">
        <h1 className="text-xl font-semibold">
          {phase === "email" ? "Sign in to AutoLink" : "Enter your code"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {phase === "email"
            ? "We'll email you a one-time code. No password needed."
            : `Sent to ${email}`}
        </p>

        {phase === "email" ? (
          <form onSubmit={sendCode} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Sending…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-[0.4em]"
                required
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Verifying…" : "Verify & continue"}
            </Button>
            <button
              type="button"
              onClick={() => setPhase("email")}
              className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
            >
              Use a different email
            </button>
          </form>
        )}
      </Card>
      <p className="mt-6 text-xs text-muted-foreground max-w-sm text-center">
        AutoLink never shows your email or phone to drivers. You'll be identified only by a system ID like <span className="font-mono">USR-4K2M</span>.
      </p>
    </div>
  );
}
