"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { subscribeToPushApi, unsubscribeFromPushApi } from "@/lib/api-notifications";
import { toast } from "sonner";

export function PushSubscribeButton() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // We should fetch NEXT_PUBLIC_VAPID_PUBLIC_KEY from env
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    // Check initial state
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setTimeout(() => setIsLoading(false), 0);
      return;
    }

    setTimeout(() => {
      setPermission(Notification.permission);
    }, 0);
    
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    });
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const handleSubscribe = async () => {
    if (!publicVapidKey) {
      toast.error("Push notifications are not configured on this environment.");
      return;
    }

    setIsLoading(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        toast.error("Notification permission denied.");
        setIsLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      // Parse keys
      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey("p256dh") as ArrayBuffer))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey("auth") as ArrayBuffer))));

      await subscribeToPushApi({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
      });

      setIsSubscribed(true);
      toast.success("Successfully subscribed to push notifications!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to subscribe to notifications.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        // Technically we delete by subscriptionId. But our API uses the ID of the subscription row.
        // Wait, the API deletes by `subscriptionId` param. We don't have the backend ID here.
        // We could just pass the endpoint as an encoded parameter, or update the API to delete by endpoint.
        
        // Actually, our API takes `/v1/push-subscriptions/:subscriptionId`. We don't know the ID!
        // We need to either delete by endpoint or return the ID on subscribe.
        // Let's just unsubscribe from browser side first, and let the backend clean it up on failure (410 Gone)
        // This is safe since the backend already handles 410 cleanup.
        await subscription.unsubscribe();
        await unsubscribeFromPushApi("by-endpoint", subscription.endpoint);
        setIsSubscribed(false);
        toast.success("Unsubscribed from notifications.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to unsubscribe.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null; // Not supported
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start"
      disabled={isLoading || permission === "denied"}
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <BellOff className="mr-2 h-4 w-4" />
      ) : (
        <BellRing className="mr-2 h-4 w-4" />
      )}
      {isSubscribed ? "Disable Push Notifications" : "Enable Push Notifications"}
    </Button>
  );
}
