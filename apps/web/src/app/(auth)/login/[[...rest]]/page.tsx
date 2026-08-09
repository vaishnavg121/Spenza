import { SignIn } from "@clerk/nextjs";
import { safeAuthReturnPath } from "@/lib/auth-return";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  const returnPath = safeAuthReturnPath((await searchParams).redirect_url);
  return (
    <SignIn
      routing="path"
      path="/login"
      fallbackRedirectUrl={returnPath ?? "/dashboard"}
      forceRedirectUrl={returnPath}
      signUpUrl={returnPath ? `/signup?redirect_url=${encodeURIComponent(returnPath)}` : "/signup"}
    />
  );
}
