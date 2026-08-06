import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-background">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <h1 className="text-6xl font-bold tracking-tight text-center">
          Welcome to <span className="text-primary">Spenza</span>
        </h1>
        <p className="text-xl text-muted-foreground text-center max-w-2xl">
          The easiest way to split expenses with your friends. Say goodbye to the hassle of math and awkward money conversations.
        </p>
        <div className="flex gap-4 mt-8">
          <Link href="/login">
            <Button size="lg" className="text-lg px-8">
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="text-lg px-8">
              Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}