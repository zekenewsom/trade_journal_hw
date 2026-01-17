import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Trade Platform</h1>
        <p className="text-muted-foreground">
          Institutional-grade trade analytics for serious traders
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/api/auth/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
