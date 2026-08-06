"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFriends, getPendingRequests, acceptFriendRequest, declineFriendRequest } from "@/actions/friends";
import { AddFriendDialog } from "@/components/friends/add-friend-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function FriendsPage() {
  const queryClient = useQueryClient();

  const { data: friends, isLoading: friendsLoading, isError: friendsError, refetch: refetchFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
  });

  const { data: requests, isLoading: requestsLoading, isError: requestsError, refetch: refetchRequests } = useQuery({
    queryKey: ["friend-requests"],
    queryFn: () => getPendingRequests(),
  });

  const acceptMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      toast.success("Friend request accepted!");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      toast.success("Friend request declined");
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    },
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Friends"
        description="Manage your network to easily add people to groups."
        action={<AddFriendDialog />}
      />

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
          <TabsTrigger value="friends">My Friends</TabsTrigger>
          <TabsTrigger value="requests">
            Friend Requests
            {requests && requests.length > 0 && (
               <span className="ml-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {requests.length}
               </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="pt-5 sm:pt-6">
          {friendsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading friends" aria-busy="true">
              {[1, 2, 3].map((item) => (
                <Card key={item} className="shadow-sm">
                  <CardContent className="flex items-center gap-3 p-5">
                    <Skeleton className="size-12 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : friendsError ? (
            <EmptyState
              icon={Users}
              title="Friends unavailable"
              description="We couldn&apos;t load your friends right now."
              action={<Button type="button" onClick={() => refetchFriends()}>Try again</Button>}
            />
          ) : friends?.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No friends yet"
              description="Add friends by their email to start splitting bills."
              action={<AddFriendDialog />}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {friends?.map((friend) => (
                <Card key={friend.id} className="shadow-sm">
                  <CardContent className="flex items-center gap-3 p-5 sm:gap-4 sm:p-6">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={friend.image || ""} />
                      <AvatarFallback>{friend.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-semibold truncate">{friend.name}</h4>
                      <p className="text-sm text-muted-foreground truncate">{friend.email}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="pt-5 sm:pt-6">
           {requestsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading friend requests" aria-busy="true">
              {[1, 2].map((item) => <Skeleton key={item} className="h-44 rounded-2xl" />)}
            </div>
          ) : requestsError ? (
            <EmptyState
              icon={UserPlus}
              title="Requests unavailable"
              description="We couldn&apos;t load friend requests right now."
              action={<Button type="button" onClick={() => refetchRequests()}>Try again</Button>}
            />
          ) : requests?.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No pending requests"
              description="You&apos;re all caught up."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {requests?.map((req) => (
                <Card key={req.id} className="shadow-sm">
                  <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
                     <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                           <AvatarImage src={req.user1.image || ""} />
                           <AvatarFallback>{req.user1.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                           <h4 className="font-semibold truncate">{req.user1.name}</h4>
                           <p className="text-sm text-muted-foreground truncate">{req.user1.email}</p>
                        </div>
                     </div>
                     <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button 
                           className="flex-1" 
                           onClick={() => acceptMutation.mutate(req.id)}
                           disabled={acceptMutation.isPending}
                        >
                           <Check className="mr-2 h-4 w-4" /> Accept
                        </Button>
                        <Button 
                           variant="outline" 
                           className="flex-1"
                           onClick={() => declineMutation.mutate(req.id)}
                           disabled={declineMutation.isPending}
                        >
                           <X className="mr-2 h-4 w-4" /> Decline
                        </Button>
                     </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
