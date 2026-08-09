"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUploadRequestApi,
  finalizeUploadApi,
  getReceiptUrlApi,
  listExpenseReceiptsApi,
  uploadReceiptBinaryApi,
} from "@/lib/api-receipts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImageIcon, Loader2, Paperclip } from "lucide-react";

interface ReceiptManagerProps {
  groupId: string;
  expenseId: string;
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ReceiptManager({ groupId, expenseId }: ReceiptManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const receiptQueryKey = ["receipts", groupId, expenseId] as const;

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: receiptQueryKey,
    queryFn: () => listExpenseReceiptsApi(groupId, expenseId),
  });
  const receiptUrls = useQuery({
    queryKey: ["receipt-urls", groupId, expenseId, ...receipts.map((receipt) => receipt.id)],
    queryFn: async () => Object.fromEntries(
      await Promise.all(receipts.map(async (receipt) => [receipt.id, (await getReceiptUrlApi(groupId, receipt.id)).url] as const)),
    ),
    enabled: receipts.length > 0,
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
      toast.error("Choose a JPEG, PNG, or WebP image");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast.error("Receipt images must be 10 MB or smaller");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const uploadRequest = await createUploadRequestApi(groupId, {
        expenseId,
        contentType: file.type,
        sizeBytes: file.size,
      });
      await uploadReceiptBinaryApi(uploadRequest, file);
      await finalizeUploadApi(groupId, uploadRequest.id);
      await queryClient.invalidateQueries({ queryKey: receiptQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["receipt-urls", groupId, expenseId] });
      await queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
      toast.success("Receipt attached");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to attach receipt");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs text-muted-foreground"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Paperclip className="mr-2 h-3 w-3" />}
        {receipts.length > 0 ? "Add another receipt" : "Add Receipt"}
      </Button>

      {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading receipts" /> : null}
      {receipts.map((receipt, index) => (
        <Button
          key={receipt.id}
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-blue-600 dark:text-blue-400"
          asChild={Boolean(receiptUrls.data?.[receipt.id])}
          disabled={!receiptUrls.data?.[receipt.id]}
        >
          {receiptUrls.data?.[receipt.id] ? (
            <a href={receiptUrls.data[receipt.id]} target="_blank" rel="noopener noreferrer">
              <ImageIcon className="mr-2 h-3 w-3" />
              Receipt {index + 1}
            </a>
          ) : (
            <span><Loader2 className="mr-2 inline h-3 w-3 animate-spin" />Receipt {index + 1}</span>
          )}
        </Button>
      ))}
    </div>
  );
}
