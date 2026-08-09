import { SignIn } from "@clerk/nextjs";

export default function AuthPage() {
  return (
    <SignIn
      routing="path"
      path="/login"
      fallbackRedirectUrl="/dashboard"
      signUpUrl="/signup"
    />
  );
}
