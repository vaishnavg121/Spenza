import { Storage } from "@google-cloud/storage";

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
  private objects = new Map<string, { contentType: string; sizeBytes: number }>();

  async generateUploadUrl(objectKey: string, contentType: string, sizeBytes: number): Promise<SignedUpload> {
    this.objects.set(objectKey, { contentType, sizeBytes });
    return {
      uploadUrl: `https://mock-storage.com/upload/${objectKey}`,
      method: "PUT",
      objectKey,
    };
  }

  async generateDownloadUrl(objectKey: string): Promise<string> {
    return `https://mock-storage.com/download/${objectKey}`;
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }

  async verifyObjectMetadata(objectKey: string, expectedContentType: string, expectedSizeBytes: number): Promise<boolean> {
    const obj = this.objects.get(objectKey);
    if (!obj) return false;
    return obj.contentType === expectedContentType && obj.sizeBytes === expectedSizeBytes;
  }
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
