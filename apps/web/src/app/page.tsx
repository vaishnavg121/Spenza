import Link from "next/link";
import { ArrowRight, ReceiptText, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/60">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">S</span>
          Spenza
        </Link>
        <Button variant="ghost" asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20 lg:px-8 lg:pt-28">
        <p className="rounded-full border bg-background px-3 py-1 text-sm font-medium text-muted-foreground shadow-sm">
          Shared expenses, made clearer
        </p>
        <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Split expenses without losing track of the details.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Keep groups, expenses, and balances in one calm shared space â€” wherever you are.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link href="/login">
              Get started <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        </div>
        <div className="mt-14 grid w-full gap-3 text-left sm:grid-cols-3">
          {[
            { icon: Users, title: "Stay together", copy: "See your shared groups and people at a glance." },
            { icon: ReceiptText, title: "Capture expenses", copy: "Keep every shared cost easy to understand." },
            { icon: WalletCards, title: "Know your balance", copy: "See what is owed without the awkward math." },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-2xl border bg-card p-5 shadow-sm">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
