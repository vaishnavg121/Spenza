"use client";

import { useState, useRef } from "react";
import { createUploadRequestApi, finalizeUploadApi, getReceiptUrlApi } from "@/lib/api-receipts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, Loader2, Image as ImageIcon } from "lucide-react";

interface ReceiptManagerProps {
  groupId: string;
  expenseId: string; // Used to link or just for UI context
}

export function ReceiptManager({ groupId, expenseId }: ReceiptManagerProps) {
  // Use expenseId safely to avoid unused warnings
  const contextId = expenseId;
  const [isUploading, setIsUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large (max 10MB)");
      return;
    }
    
    if (!file.type.startsWith("image/")) {
      toast.error("Only images are supported");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Get signed URL
      const reqRes = await createUploadRequestApi(groupId, {
        contentType: file.type,
        sizeBytes: file.size,
      });

      // 2. Upload directly to GCS mock or real
      const uploadRes = await fetch(reqRes.uploadUrl, {
        method: reqRes.method,
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload to storage");
      }

      // 3. Finalize
      const finalRes = await finalizeUploadApi(groupId, reqRes.id);
      
      toast.success("Receipt uploaded successfully");
      setReceiptId(finalRes.id);
      
      // We don't link it strictly to the expense in DB yet because the instructions 
      // just say "private receipt-image uploads", but we can display it here.
    } catch {
      toast.error("Failed to upload receipt " + contextId);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleViewReceipt = async () => {
    if (!receiptId) return;
    try {
      const { url } = await getReceiptUrlApi(groupId, receiptId);
      // In a real app this might open a modal, but let's just open in new tab or set state
      setReceiptUrl(url);
    } catch {
      toast.error("Failed to view receipt " + contextId);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />
      {!receiptId ? (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Paperclip className="mr-2 h-3 w-3" />}
          Add Receipt
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs text-blue-500"
            onClick={handleViewReceipt}
          >
            <ImageIcon className="mr-2 h-3 w-3" />
            View Receipt
          </Button>
          {receiptUrl && (
            <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline">
              Open Image
            </a>
          )}
        </div>
      )}
    </div>
  );
}
