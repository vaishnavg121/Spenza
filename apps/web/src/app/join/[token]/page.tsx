"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { acceptGroupInviteApi, previewGroupInviteApi } from "@/lib/api-group-invites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function JoinGroupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const returnPath = `/join/${encodeURIComponent(token)}`;
  const preview = useQuery({
    queryKey: ["group-invite", token],
    queryFn: () => previewGroupInviteApi(token),
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptGroupInviteApi(token),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      await queryClient.invalidateQueries({ queryKey: ["group-details", result.groupId] });
      router.push(`/dashboard/groups/${result.groupId}`);
    },
  });

  if (preview.isLoading || !isLoaded) {
    return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" aria-label="Loading invite" /></main>;
  }

  if (preview.error || !preview.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Invite unavailable</CardTitle><CardDescription>{preview.error?.message || "This link is invalid, expired, or revoked."}</CardDescription></CardHeader>
          <CardFooter><Button asChild className="w-full"><Link href="/">Go to Spenza</Link></Button></CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users /></div>
          <CardTitle>Join {preview.data.groupName}</CardTitle>
          <CardDescription>
            {preview.data.inviterName} invited you to this {preview.data.currency} expense group. You will join as a member.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-xs text-muted-foreground">Invite expires {new Date(preview.data.expiresAt).toLocaleString()}.</p>
          {acceptMutation.error ? <p className="mt-3 text-center text-sm text-destructive">{acceptMutation.error.message}</p> : null}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          {isSignedIn ? (
            <Button className="w-full" onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Join Group
            </Button>
          ) : (
            <>
              <Button asChild className="w-full"><Link href={`/login?redirect_url=${encodeURIComponent(returnPath)}`}>Sign in to join</Link></Button>
              <Button asChild variant="outline" className="w-full"><Link href={`/signup?redirect_url=${encodeURIComponent(returnPath)}`}>Create an account</Link></Button>
            </>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
