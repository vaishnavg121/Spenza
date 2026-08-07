import { SignIn } from "@clerk/nextjs";
export default function AuthPage() { return <SignIn routing="hash" fallbackRedirectUrl="/dashboard" />; }
