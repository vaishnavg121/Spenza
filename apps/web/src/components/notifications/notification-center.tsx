"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotificationsApi, markNotificationReadApi } from "@/lib/api-notifications";
import { Bell } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { PushSubscribeButton } from "./push-subscribe-button";

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotificationsApi(),
    refetchInterval: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = data?.unreadCount || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative outline-none")}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 px-2"
              onClick={() => markReadMutation.mutate(undefined)}
              disabled={markReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <div className="px-2 pb-2">
          <PushSubscribeButton />
        </div>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !data || data.data.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {data.data.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                  !notification.isRead ? "bg-muted/40 font-medium" : ""
                }`}
                onClick={() => {
                  if (!notification.isRead) {
                    markReadMutation.mutate(notification.id);
                  }
                }}
              >
                <span className="text-sm">{notification.title}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{notification.body}</span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
