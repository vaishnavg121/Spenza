"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFriends, getPendingRequests, acceptFriendRequest, declineFriendRequest } from "@/actions/friends";
import { AddFriendDialog } from "@/components/friends/add-friend-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function FriendsPage() {
  const queryClient = useQueryClient();

  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Friends</h2>
          <p className="text-muted-foreground">
            Manage your network to easily add them to groups.
          </p>
        </div>
        <AddFriendDialog />
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2">
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

        <TabsContent value="friends" className="pt-6">
          {friendsLoading ? (
            <div className="text-muted-foreground">Loading friends...</div>
          ) : friends?.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No friends yet</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
                Add friends by their email to start splitting bills.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {friends?.map((friend) => (
                <Card key={friend.id}>
                  <CardContent className="flex items-center p-6 gap-4">
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

        <TabsContent value="requests" className="pt-6">
           {requestsLoading ? (
            <div className="text-muted-foreground">Loading requests...</div>
          ) : requests?.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-8 text-center">
              <UserPlus className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No pending requests</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requests?.map((req) => (
                <Card key={req.id}>
                  <CardContent className="flex flex-col p-6 gap-4">
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
                     <div className="flex items-center gap-2 mt-2">
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
