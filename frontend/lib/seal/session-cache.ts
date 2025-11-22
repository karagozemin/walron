/**
 * SessionKey cache for Seal SDK
 * Stores SessionKey in localStorage to persist across page refreshes
 * SessionKey is valid for 30 minutes
 * 
 * ⚠️ SECURITY NOTE: SessionKey is stored in localStorage for better UX
 * This means it persists across page refreshes but is vulnerable to XSS attacks.
 * In a production environment, consider additional security measures.
 */

import { SessionKey } from "@mysten/seal";
import { SuiClient } from "@mysten/sui/client";

interface CachedSession {
  sessionKeyData: string; // Serialized SessionKey creation params
  expiresAt: number; // timestamp in ms
  address: string;
  packageId: string; // For reconstruction
  signature: string; // User signature for reconstruction
  personalMessage: string; // Base64 encoded message
}

const STORAGE_KEY = 'seal_session_cache';

// In-memory cache for the actual SessionKey object
let sessionKeyInstance: SessionKey | null = null;

// Promise lock to prevent multiple simultaneous SessionKey creations
let creationPromise: Promise<SessionKey> | null = null;

/**
 * Load SessionKey from localStorage
 */
function loadFromStorage(address: string, packageId: string, suiClient: SuiClient): SessionKey | null {
  if (typeof window === 'undefined') return null; // Server-side check
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const cached: CachedSession = JSON.parse(stored);
    const now = Date.now();
    
    // Check if expired or wrong address
    if (cached.expiresAt <= now || cached.address !== address) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    // Reconstruct SessionKey from stored data
    // Note: This is a simplified approach - real SessionKey reconstruction
    // would need proper deserialization if the SDK supports it
    const remainingMin = Math.floor((cached.expiresAt - now) / 1000 / 60);
    console.log(`💾 Loaded SessionKey from localStorage (${remainingMin} min remaining)`);
    
    // For now, we'll return null and force recreation
    // TODO: Implement proper SessionKey serialization/deserialization
    return null;
  } catch (error) {
    console.error("Failed to load SessionKey from storage:", error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Save SessionKey metadata to localStorage
 * We can't serialize the SessionKey class itself, so we store the params
 * needed to reconstruct it
 */
function saveToStorage(
  sessionKey: SessionKey, 
  expiresAt: number, 
  address: string,
  packageId: string,
  signature: string,
  personalMessage: Uint8Array
) {
  if (typeof window === 'undefined') return; // Server-side check
  
  try {
    const cached: CachedSession = {
      sessionKeyData: 'stored',
      expiresAt,
      address,
      packageId,
      signature,
      personalMessage: btoa(String.fromCharCode(...personalMessage)), // Base64 encode
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

/**
 * Get or create a SessionKey for the given address
 * Reuses cached SessionKey if still valid (within 30 min)
 * Uses promise lock to prevent duplicate creations
 * Persists to localStorage for cross-refresh usage
 */
export async function getOrCreateSessionKey(
  address: string,
  packageId: string,
  suiClient: SuiClient,
  signPersonalMessage: (args: { message: Uint8Array }) => Promise<{ signature: string }>
): Promise<SessionKey> {
  const now = Date.now();
  
  // Check in-memory instance first
  if (sessionKeyInstance) {
    // Check localStorage for expiry
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      const cached: CachedSession = JSON.parse(stored);
      if (cached.expiresAt > now && cached.address === address) {
        const remainingMin = Math.floor((cached.expiresAt - now) / 1000 / 60);
        console.log(`♻️ Session active (${remainingMin} min remaining)`);
        return sessionKeyInstance;
      }
    }
  }
  
  // If another content is already creating a SessionKey, wait for it
  if (creationPromise) {
    console.log("⏳ Waiting for session...");
    return await creationPromise;
  }
  
  // Try to restore from localStorage (after page refresh)
  // NOTE: We need to re-sign because SessionKey.create() generates a new personalMessage
  // each time, and the old signature won't match the new message
  if (!sessionKeyInstance && typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (stored) {
      try {
        const cached: CachedSession = JSON.parse(stored);
        
        if (cached.expiresAt > now && cached.address === address && cached.packageId === packageId) {
          // We have a valid cached session, but need to re-sign once after refresh
          // NOTE: This is a Seal SDK limitation - SessionKey can't be fully serialized
          console.log("🔐 Session found - re-signing after page refresh (security requirement)");
          
          // Use the creation promise lock to prevent duplicate signs
          creationPromise = (async () => {
            try {
              // Recreate SessionKey
              const sessionKey = await SessionKey.create({
                address: cached.address,
                packageId: cached.packageId,
                ttlMin: 30,
                suiClient,
              });
              
            // Re-sign with new personalMessage
            const message = sessionKey.getPersonalMessage();
            console.log("🖊️ Requesting signature (required after refresh for security)...");
            const { signature } = await signPersonalMessage({ message });
            sessionKey.setPersonalMessageSignature(signature);
            
            sessionKeyInstance = sessionKey;
            const remainingMin = Math.floor((cached.expiresAt - now) / 1000 / 60);
            
            // Update storage with new signature
            saveToStorage(sessionKey, cached.expiresAt, address, packageId, signature, message);
            
            console.log(`✅ Session restored (valid for ${remainingMin} min)`);
              return sessionKeyInstance;
            } finally {
              creationPromise = null;
            }
          })();
          
          return await creationPromise;
        } else {
          // Expired or wrong address/package
          localStorage.removeItem(STORAGE_KEY);
          console.log("🗑️  Expired/invalid SessionKey removed from localStorage");
        }
      } catch (e) {
        console.error("Failed to parse localStorage SessionKey:", e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }
  
  // Create new SessionKey with lock
  console.log("🔑 Creating new secure session...");
  
  creationPromise = (async () => {
    try {
      const sessionKey = await SessionKey.create({
        address,
        packageId,
        ttlMin: 30, // Max 30 minutes
        suiClient,
      });
      
      const message = sessionKey.getPersonalMessage();
      console.log("🖊️ Requesting signature to create secure session (valid 28 min)...");
      const { signature } = await signPersonalMessage({ message });
      sessionKey.setPersonalMessageSignature(signature);
      
      // Cache for 28 minutes (2 min buffer before expiry)
      const expiresAt = Date.now() + 28 * 60 * 1000;
      
      // Store in memory
      sessionKeyInstance = sessionKey;
      
      // Store metadata in localStorage (for reconstruction after refresh)
      saveToStorage(sessionKey, expiresAt, address, packageId, signature, message);
      
      console.log("✅ Secure session created (28 min)");
      return sessionKey;
    } finally {
      // Release lock
      creationPromise = null;
    }
  })();
  
  return await creationPromise;
}

/**
 * Clear the cached session (for logout, etc.)
 */
export function clearSessionCache() {
  sessionKeyInstance = null;
  creationPromise = null;
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  
  console.log("🗑️ Session cleared");
}

