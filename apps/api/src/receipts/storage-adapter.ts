import { Storage } from "@google-cloud/storage";
import { randomBytes } from "node:crypto";

export interface SignedUpload {
  uploadUrl: string;
  method: string;
  objectKey: string;
}

export interface StorageAdapter {
  generateUploadUrl(objectKey: string, contentType: string, sizeBytes: number): Promise<SignedUpload>;
  generateDownloadUrl(objectKey: string): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
  verifyObjectMetadata(objectKey: string, expectedContentType: string, expectedSizeBytes: number): Promise<boolean>;
}

export class MockStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, { contentType: string; bytes: Buffer }>();
  private readonly uploadTickets = new Map<string, {
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    expiresAt: number;
  }>();
  private readonly downloadTickets = new Map<string, { objectKey: string; expiresAt: number }>();

  async generateUploadUrl(objectKey: string, contentType: string, sizeBytes: number): Promise<SignedUpload> {
    const token = randomBytes(32).toString("base64url");
    this.uploadTickets.set(token, {
      objectKey,
      contentType,
      sizeBytes,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return {
      uploadUrl: `/v1/local-receipt-uploads/${token}`,
      method: "PUT",
      objectKey,
    };
  }

  async generateDownloadUrl(objectKey: string): Promise<string> {
    if (!this.objects.has(objectKey)) {
      throw new Error("Receipt object is unavailable");
    }
    const token = randomBytes(32).toString("base64url");
    this.downloadTickets.set(token, { objectKey, expiresAt: Date.now() + 60 * 60 * 1000 });
    return `/v1/local-receipt-downloads/${token}`;
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }

  async verifyObjectMetadata(objectKey: string, expectedContentType: string, expectedSizeBytes: number): Promise<boolean> {
    const obj = this.objects.get(objectKey);
    if (!obj) return false;
    return obj.contentType === expectedContentType && obj.bytes.byteLength === expectedSizeBytes;
  }

  acceptUpload(
    token: string,
    contentType: string,
    bytes: Buffer,
  ): { ok: true } | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "CONTENT_TYPE" | "SIZE" } {
    const ticket = this.uploadTickets.get(token);
    if (!ticket) return { ok: false, reason: "NOT_FOUND" };
    if (ticket.expiresAt <= Date.now()) {
      this.uploadTickets.delete(token);
      return { ok: false, reason: "EXPIRED" };
    }
    if (ticket.contentType !== contentType) return { ok: false, reason: "CONTENT_TYPE" };
    if (ticket.sizeBytes !== bytes.byteLength) return { ok: false, reason: "SIZE" };

    this.objects.set(ticket.objectKey, { contentType, bytes: Buffer.from(bytes) });
    this.uploadTickets.delete(token);
    return { ok: true };
  }

  readDownload(token: string): { contentType: string; bytes: Buffer } | null {
    const ticket = this.downloadTickets.get(token);
    if (!ticket || ticket.expiresAt <= Date.now()) {
      this.downloadTickets.delete(token);
      return null;
    }
    const object = this.objects.get(ticket.objectKey);
    if (!object) return null;
    return { contentType: object.contentType, bytes: Buffer.from(object.bytes) };
  }
}

export function isMockStorageAdapter(adapter: StorageAdapter): adapter is MockStorageAdapter {
  return adapter instanceof MockStorageAdapter;
}

export class GcsStorageAdapter implements StorageAdapter {
  private readonly storage: Storage;
  
  constructor(private readonly bucketName: string) {
    // Relies on Application Default Credentials (ADC)
    this.storage = new Storage();
  }

  async generateUploadUrl(objectKey: string, contentType: string, sizeBytes: number): Promise<SignedUpload> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectKey);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
      extensionHeaders: {
        'x-goog-content-length-range': `0,${sizeBytes}`,
      },
    });

    return {
      uploadUrl,
      method: "PUT",
      objectKey,
    };
  }

  async generateDownloadUrl(objectKey: string): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectKey);

    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return downloadUrl;
  }

  async deleteObject(objectKey: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectKey);
    
    try {
      await file.delete();
    } catch (error: any) {
      if (error.code !== 404) {
        throw error;
      }
    }
  }

  async verifyObjectMetadata(objectKey: string, expectedContentType: string, expectedSizeBytes: number): Promise<boolean> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectKey);

    try {
      const [metadata] = await file.getMetadata();
      const actualSizeStr = metadata.size;
      const actualSize = actualSizeStr ? parseInt(String(actualSizeStr), 10) : 0;
      const actualType = metadata.contentType;
      
      return actualSize === expectedSizeBytes && actualType === expectedContentType;
    } catch (error: any) {
      if (error.code === 404) return false;
      throw error;
    }
  }
}
