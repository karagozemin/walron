// Walrus testnet URLs - try multiple options
const WALRUS_PUBLISHERS = [
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER || "https://publisher.walrus-testnet.walrus.space",
  "https://walrus-testnet-publisher.nodes.guru",
  "https://wal-publisher-testnet.staketab.org",
];

const WALRUS_PUBLISHER = WALRUS_PUBLISHERS[0];

// Multiple aggregator options to try (for backward compatibility with old content)
const WALRUS_AGGREGATORS = [
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space",
  "https://walrus-testnet-aggregator.nodes.guru",
  "https://wal-aggregator-testnet.staketab.org",
];

const WALRUS_AGGREGATOR = WALRUS_AGGREGATORS[0];

export interface UploadResponse {
  blobId: string;
  endEpoch: number;
  suiRef?: string;
}

export class WalrusService {
  private publisherUrl: string;
  private aggregatorUrl: string;
  private aggregatorUrls: string[];

  constructor() {
    this.publisherUrl = WALRUS_PUBLISHER;
    this.aggregatorUrl = WALRUS_AGGREGATOR;
    this.aggregatorUrls = WALRUS_AGGREGATORS;
  }

  /**
   * Upload a file to Walrus
   * Based on official example: https://github.com/MystenLabs/walrus/blob/main/docs/examples/javascript/blob_upload_download_webapi.html
   */
  async uploadFile(file: File): Promise<UploadResponse> {
    try {
      console.log("Uploading to Walrus:", this.publisherUrl);
      console.log("File size:", file.size, "bytes");

      // Use the correct endpoint: /v1/blobs with epochs parameter
      // Following the official JavaScript example
      // epochs=30 means content will be stored for 30 epochs (much longer than epochs=1)
      const numEpochs = 30;
      const response = await fetch(`${this.publisherUrl}/v1/blobs?epochs=${numEpochs}`, {
        method: "PUT",
        body: file,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Walrus error response:", errorText);
        throw new Error(`Walrus upload failed (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Walrus response:", data);
      
      // Response format from Walrus docs:
      // { newlyCreated: { blobObject: { blobId, storage: { endEpoch }, id } } }
      // or { alreadyCertified: { blobId, endEpoch, event: { txDigest } } }
      if (data.newlyCreated) {
        return {
          blobId: data.newlyCreated.blobObject.blobId,
          endEpoch: data.newlyCreated.blobObject.storage.endEpoch,
          suiRef: data.newlyCreated.blobObject.id,
        };
      } else if (data.alreadyCertified) {
        return {
          blobId: data.alreadyCertified.blobId,
          endEpoch: data.alreadyCertified.endEpoch,
        };
      }

      throw new Error("Unexpected Walrus response format");
    } catch (error: any) {
      console.error("Walrus upload error:", error);
      throw error;
    }
  }

  /**
   * Download a file from Walrus
   * Tries multiple aggregators and publishers if the first one fails (for backward compatibility)
   * Based on official example: GET /v1/blobs/{blob_id}
   */
  async downloadFile(blobId: string): Promise<Blob> {
    // Validate blob ID
    if (!blobId || blobId.trim() === "") {
      throw new Error("Invalid blob ID: blob ID is empty");
    }

    const errors: string[] = [];
    
    // First, try all aggregators
    for (const aggregatorUrl of this.aggregatorUrls) {
      try {
        console.log(`🔍 Trying aggregator: ${aggregatorUrl}`);
        
        const response = await fetch(`${aggregatorUrl}/v1/blobs/${blobId}`, {
          method: "GET",
          headers: {
            'Accept': '*/*',
          },
        });
        
        if (response.ok) {
          console.log(`✅ Successfully downloaded from aggregator: ${aggregatorUrl}`);
          const blob = await response.blob();
          console.log(`📦 Blob downloaded: ${blob.size} bytes`);
          return blob;
        }
        
        // If 404, try next aggregator
        if (response.status === 404) {
          console.warn(`⚠️ Blob not found on ${aggregatorUrl} (404)`);
          errors.push(`${aggregatorUrl}: 404 Not Found`);
          continue;
        }
        
        // For other errors, log and try next
        const errorText = await response.text().catch(() => response.statusText);
        console.warn(`⚠️ Error from ${aggregatorUrl} (${response.status}): ${errorText.substring(0, 100)}`);
        errors.push(`${aggregatorUrl}: ${response.status} ${errorText.substring(0, 100)}`);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Network error from ${aggregatorUrl}: ${errorMsg}`);
        errors.push(`${aggregatorUrl}: ${errorMsg}`);
        continue;
      }
    }
    
    // If all aggregators failed, try publishers (sometimes old blobs are only on publisher)
    console.log(`⚠️ All aggregators failed, trying publishers...`);
    for (const publisherUrl of WALRUS_PUBLISHERS) {
      try {
        console.log(`🔍 Trying publisher: ${publisherUrl}`);
        
        const response = await fetch(`${publisherUrl}/v1/blobs/${blobId}`, {
          method: "GET",
          headers: {
            'Accept': '*/*',
          },
        });
        
        if (response.ok) {
          console.log(`✅ Successfully downloaded from publisher: ${publisherUrl}`);
          const blob = await response.blob();
          console.log(`📦 Blob downloaded: ${blob.size} bytes`);
          return blob;
        }
        
        // If 404, try next publisher
        if (response.status === 404) {
          console.warn(`⚠️ Blob not found on ${publisherUrl} (404)`);
          errors.push(`${publisherUrl}: 404 Not Found`);
          continue;
        }
        
        // For other errors, log and try next
        const errorText = await response.text().catch(() => response.statusText);
        console.warn(`⚠️ Error from ${publisherUrl} (${response.status}): ${errorText.substring(0, 100)}`);
        errors.push(`${publisherUrl}: ${response.status} ${errorText.substring(0, 100)}`);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Network error from ${publisherUrl}: ${errorMsg}`);
        errors.push(`${publisherUrl}: ${errorMsg}`);
        continue;
      }
    }
    
    // All aggregators and publishers failed
    const errorMessage = `Failed to download blob ${blobId.substring(0, 20)}... from all sources:\n${errors.join('\n')}`;
    console.error("❌", errorMessage);
    
    // Check if all errors are 404s (likely expired)
    const all404s = errors.every(e => e.includes('404'));
    
    if (all404s) {
      throw new Error(
        `❌ İçerik bulunamadı - Muhtemelen expire olmuş\n\n` +
        `Bu içerik Walrus storage'da bulunamadı. Tüm aggregator ve publisher'larda denendi:\n` +
        `• ${this.aggregatorUrls.join('\n• ')}\n` +
        `• ${WALRUS_PUBLISHERS.join('\n• ')}\n\n` +
        `🔴 Muhtemel Sebep: İçerik expire olmuş\n` +
        `Eski içerikler epochs=1 ile yüklendiği için 1 epoch sonra expire oluyor.\n\n` +
        `💡 Çözüm: Bu içeriği yeniden yüklemeniz gerekiyor.\n\n` +
        `Blob ID: ${blobId}`
      );
    }
    
    throw new Error(
      `❌ İçerik yüklenemedi\n\n` +
      `Walrus storage'dan içerik indirilemedi. Denenen kaynaklar:\n` +
      `• ${this.aggregatorUrls.join('\n• ')}\n` +
      `• ${WALRUS_PUBLISHERS.join('\n• ')}\n\n` +
      `Hatalar:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
      `Blob ID: ${blobId}`
    );
  }

  /**
   * Get the URL for a blob
   */
  getBlobUrl(blobId: string): string {
    return `${this.aggregatorUrl}/v1/blobs/${blobId}`;
  }

  /**
   * Check if a blob exists (tries multiple aggregators and publishers)
   */
  async blobExists(blobId: string): Promise<boolean> {
    if (!blobId || blobId.trim() === "") {
      return false;
    }

    // Try aggregators first
    for (const aggregatorUrl of this.aggregatorUrls) {
      try {
        const response = await fetch(`${aggregatorUrl}/v1/blobs/${blobId}`, {
          method: "HEAD",
        });
        if (response.ok) {
          return true;
        }
      } catch {
        continue;
      }
    }

    // Try publishers if aggregators failed
    for (const publisherUrl of WALRUS_PUBLISHERS) {
      try {
        const response = await fetch(`${publisherUrl}/v1/blobs/${blobId}`, {
          method: "HEAD",
        });
        if (response.ok) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }
}

// Export singleton instance
export const walrusService = new WalrusService();

