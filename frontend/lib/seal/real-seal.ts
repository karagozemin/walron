/**
 * Real Seal SDK Integration
 * Using official @mysten/seal package
 */

import { SealClient, DemType } from '@mysten/seal';
import type { SealClientOptions } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';

// KemType enum (from Seal SDK)
enum KemType {
  BonehFranklinBLS12381DemCCA = 0
}

// Seal key server configuration (using Walrus testnet)
// Real production key servers from verified providers
// Note: Using only the most reliable key servers for better performance
const KEY_SERVER_CONFIGS = [
  {
    objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', // Key Server 1 (verified, fast)
    weight: 1,
  },
  {
    objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', // Key Server 2 (verified, fast)
    weight: 1,
  },
];

const THRESHOLD = 1; // Need 1 out of 2 key servers (lower threshold for better performance)

export interface RealSealEncryptionResult {
  encryptedObject: Uint8Array;
  symmetricKey: Uint8Array;
  packageId: string;
  id: string;
}

export class RealSealService {
  private sealClient: SealClient | null = null;
  private suiClient: SuiClient;

  constructor(suiClient: SuiClient) {
    this.suiClient = suiClient;
  }

  /**
   * Initialize Seal client
   */
  async initialize(): Promise<void> {
    if (this.sealClient) return;

    try {
      // Create Seal client with key server configuration
      const options: SealClientOptions = {
        suiClient: this.suiClient as any, // Type assertion for compatibility
        serverConfigs: KEY_SERVER_CONFIGS,
        verifyKeyServers: false, // Disable verification for faster initialization
        timeout: 120000, // 120 second timeout (2 minutes) for large files
      };

      this.sealClient = new SealClient(options);
      
      console.log('✅ Real Seal SDK initialized');
    } catch (error) {
      console.error('Failed to initialize Seal SDK:', error);
      throw error;
    }
  }

  /**
   * Encrypt content using real Seal SDK
   * 
   * @param data - Content to encrypt
   * @param packageId - Package ID for the Seal policy
   * @param identity - Identity to encrypt for (e.g., tier ID or content ID)
   * @returns Encrypted object and symmetric key
   */
  async encryptContent(
    data: Uint8Array,
    packageId: string,
    identity: string
  ): Promise<RealSealEncryptionResult> {
    if (!this.sealClient) {
      await this.initialize();
    }

    try {
      console.log('🔐 Encrypting with real Seal SDK...', {
        dataSize: data.length,
        packageId,
        identity,
        threshold: THRESHOLD,
        keyServers: KEY_SERVER_CONFIGS.length,
      });

      const startTime = Date.now();
      
      const result = await this.sealClient!.encrypt({
        kemType: KemType.BonehFranklinBLS12381DemCCA, // BLS12-381 IBE
        demType: DemType.AesGcm256, // AES-256-GCM encryption
        threshold: THRESHOLD,
        packageId,
        id: identity,
        data,
        aad: new Uint8Array(), // Additional authenticated data (optional)
      });

      const elapsed = Date.now() - startTime;
      console.log('✅ Encryption successful', {
        encryptedSize: result.encryptedObject.length,
        keySize: result.key.length,
        timeMs: elapsed,
      });

      return {
        encryptedObject: result.encryptedObject,
        symmetricKey: result.key,
        packageId,
        id: identity,
      };
    } catch (error) {
      console.error('❌ Seal encryption failed:', error);
      console.error('Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 3),
      });
      throw error;
    }
  }

  /**
   * Decrypt content using real Seal SDK
   * 
   * @param encryptedObject - Encrypted data from Seal
   * @param txBytes - Transaction bytes that approve access
   * @param sessionKey - Optional session key for caching
   * @returns Decrypted plaintext
   */
  async decryptContent(
    encryptedObject: Uint8Array,
    txBytes: Uint8Array,
    sessionKey: any
  ): Promise<Uint8Array> {
    if (!this.sealClient) {
      await this.initialize();
    }

    try {
      console.log('🔓 Decrypting with real Seal SDK...', {
        encryptedSize: encryptedObject.length,
        hasTxBytes: !!txBytes,
        hasSessionKey: !!sessionKey,
      });

      const decrypted = await this.sealClient!.decrypt({
        data: encryptedObject,
        txBytes,
        sessionKey,
        checkShareConsistency: true, // Verify all key servers agree
        checkLEEncoding: false,
      });

      console.log('✅ Decryption successful', {
        decryptedSize: decrypted.length,
      });

      return new Uint8Array(decrypted);
    } catch (error) {
      console.error('❌ Seal decryption failed:', error);
      throw error;
    }
  }

  /**
   * Fetch decryption keys from key servers
   * This should be called before decrypt to cache keys
   * 
   * @param ids - Identity IDs to fetch keys for
   * @param txBytes - Transaction bytes that approve access
   * @param sessionKey - Optional session key
   */
  async fetchKeys(
    ids: string[],
    txBytes: Uint8Array,
    sessionKey?: any
  ): Promise<void> {
    if (!this.sealClient) {
      await this.initialize();
    }

    try {
      console.log('🔑 Fetching keys from Seal key servers...', { ids });

      await this.sealClient!.fetchKeys({
        ids,
        txBytes,
        sessionKey,
        threshold: THRESHOLD,
      });

      console.log('✅ Keys fetched successfully');
    } catch (error) {
      console.error('❌ Failed to fetch keys:', error);
      throw error;
    }
  }

  /**
   * Get key servers information
   */
  async getKeyServers() {
    if (!this.sealClient) {
      await this.initialize();
    }

    return await this.sealClient!.getKeyServers();
  }
}

// Export singleton instance
let realSealServiceInstance: RealSealService | null = null;

export function getRealSealService(suiClient: SuiClient): RealSealService {
  if (!realSealServiceInstance) {
    realSealServiceInstance = new RealSealService(suiClient);
  }
  return realSealServiceInstance;
}

