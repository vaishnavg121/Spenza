import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      routing="path"
      path="/signup"
      fallbackRedirectUrl="/dashboard"
      signInUrl="/login"
    />
  );
}
