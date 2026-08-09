import { SignUp } from "@clerk/nextjs";
import { safeAuthReturnPath } from "@/lib/auth-return";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const returnPath = safeAuthReturnPath((await searchParams).redirect_url);
  return (
    <SignUp
      routing="path"
      path="/signup"
      fallbackRedirectUrl={returnPath ?? "/dashboard"}
      forceRedirectUrl={returnPath}
      signInUrl={returnPath ? `/login?redirect_url=${encodeURIComponent(returnPath)}` : "/login"}
    />
  );
}
