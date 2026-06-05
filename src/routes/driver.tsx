import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/driver")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Driver — MaATO" },
      { name: "description", content: "MaATO driver app — go online and accept nearby passenger requests." },
    ],
  }),
  component: DriverPlaceholder,
});

function DriverPlaceholder() {
  return (
    <main className="min-h-screen grid place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <div className="text-5xl mb-4">🛺</div>
        <h1 className="text-3xl font-bold tracking-tight">Driver app — coming next</h1>
        <p className="mt-3 text-muted-foreground">
          The driver experience (go online, see nearby requests, accept rides) is the next
          milestone. The passenger app is live now.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/">
            <Button variant="outline">Back to home</Button>
          </Link>
          <Link to="/passenger">
            <Button>Try passenger app</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
