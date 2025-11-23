"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { walrusService } from "@/lib/walrus/client";
import { sealService } from "@/lib/seal/encryption";
import { getRealSealService } from "@/lib/seal/real-seal";
import { suiClient } from "@/lib/sui/client";
import { 
  findUserSubscriptionForTier, 
  createSubscriptionProof,
  createCreatorAccessProof,
  isSubscriptionActive,
  getSubscriptionExpiry,
  findCreatorProfile
} from "@/lib/seal/access-proof";
import { getOrCreateSessionKey } from "@/lib/seal/session-cache";
import { getCachedContent, cacheDecryptedContent } from "@/lib/cache/indexed-db-cache";

interface ContentViewerProps {
  content: {
    id: string;
    title: string;
    description: string;
    walrusBlobId: string;
    sealPolicyId: string;
    isPublic: boolean;
    contentType: string;
    creator: string;
    encryptionKey?: string; // Base64 encoded key from blockchain
    requiredTierId?: string;
  };
  hasAccess: boolean;
  createdAt?: string;
  compact?: boolean; // Thumbnail mode for dashboard
  requiredTierName?: string; // Name of the tier required for access
  showLockedPreview?: boolean; // Show blurred preview for locked content
}

export function ContentViewer({ 
  content, 
  hasAccess, 
  createdAt, 
  compact = false,
  requiredTierName,
  showLockedPreview = false 
}: ContentViewerProps) {
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [likes, setLikes] = useState(Math.floor(Math.random() * 100)); // Mock data
  const [comments, setComments] = useState(Math.floor(Math.random() * 20)); // Mock data
  const [isLiked, setIsLiked] = useState(false);
  const [showSessionInfo, setShowSessionInfo] = useState(false);

  useEffect(() => {
    if (hasAccess || content.isPublic) {
      loadContent();
    }
  }, [content.walrusBlobId, hasAccess]);

  const loadContent = async () => {
    setLoading(true);
    setError("");

    try {
      // Step 1: Check IndexedDB cache first (skip download & decrypt!)
      if (!content.isPublic) {
        const cachedBlob = await getCachedContent(content.id);
        if (cachedBlob) {
          console.log("♻️ Loading from IndexedDB cache (instant!)");
          const url = URL.createObjectURL(cachedBlob);
          setContentUrl(url);
          setLoading(false);
          return;
        }
        console.log("💾 Cache miss, will decrypt and cache...");
      }
      
      // Step 2: Download from Walrus
      const blob = await walrusService.downloadFile(content.walrusBlobId);
      
      if (content.isPublic) {
        // Public content - display directly
        const url = URL.createObjectURL(blob);
        setContentUrl(url);
      } else {
        // Encrypted content - decrypt with Real Seal SDK
        const encryptedObject = new Uint8Array(await blob.arrayBuffer());
        
        console.log("🔓 Decrypting content with Real Seal SDK...", {
          encryptedSize: encryptedObject.length,
          hasAccess,
          policyId: content.sealPolicyId,
          hasEncryptionKey: !!content.encryptionKey,
        });
        
        if (!hasAccess) {
          throw new Error("You don't have access to this content. Please subscribe first.");
        }
        
        if (!content.encryptionKey) {
          // Check if user is the creator
          const isCreator = account?.address === content.creator;
          const errorMsg = isCreator 
            ? "⚠️ Encryption key missing. This content was uploaded with an older version and cannot be decrypted. Please re-upload this content."
            : "🔒 This content cannot be decrypted (missing encryption key). Please contact the creator.";
          throw new Error(errorMsg);
        }
        
        // Extract encryption metadata from on-chain storage
        const keyData = atob(content.encryptionKey);
        
        // Check if this is Real Seal format
        // Format: "seal_<id>:key"
        const isRealSealFormat = keyData.startsWith('seal_');
        
        console.log("📦 Parsing encryption metadata:", {
          format: isRealSealFormat ? "Real Seal SDK (policy ID only)" : `Legacy (${keyData.split(':').length} parts)`,
          preview: keyData.substring(0, 30),
        });
        
        // ================================================================
        // REAL SEAL SDK ENCRYPTED CONTENT
        // ================================================================
        if (isRealSealFormat) {
          const parts = keyData.split(':');
          
          if (parts.length !== 2) {
            throw new Error(`Invalid Real Seal format: expected 2 parts (seal_<id>:key), got ${parts.length}`);
          }
          
          const [storedPolicyId, keyBytesStr] = parts;
          const symmetricKey = new Uint8Array(keyBytesStr.split(',').map(Number));
          const policyId = storedPolicyId.replace('seal_', ''); // Remove prefix
          
          console.log("🔐 REAL Seal SDK encrypted content detected:", {
            policyId,
            keySize: symmetricKey.length,
            encryptedSize: encryptedObject.length,
            contentId: content.id,
            encryption: "100% Real @mysten/seal SDK",
          });
          
          const isCreator = account?.address === content.creator;
          
          // ACCESS CONTROL
          if (!isCreator) {
            console.log("🔐 Verifying subscriber access...");
            
            if (!content.requiredTierId || !account?.address) {
              throw new Error("Missing tier ID or user address");
            }
            
            const subscriptionNFTId = await findUserSubscriptionForTier(
              suiClient,
              account.address,
              content.requiredTierId
            );
            
            if (!subscriptionNFTId) {
              throw new Error("No active subscription. Please subscribe to this tier.");
            }
            
            // ✅ CHECK EXPIRY - Frontend-side validation
            const subscriptionExpiry = await getSubscriptionExpiry(suiClient, subscriptionNFTId);
            if (!subscriptionExpiry) {
              throw new Error("Could not verify subscription expiry");
            }
            
            const now = Date.now();
            if (now >= subscriptionExpiry) {
              const expiredDate = new Date(subscriptionExpiry).toLocaleString();
              throw new Error(`❌ Subscription expired on ${expiredDate}. Please renew to access this content.`);
            }
            
            const daysRemaining = Math.ceil((subscriptionExpiry - now) / (1000 * 60 * 60 * 24));
            console.log(`✅ Subscription active (${daysRemaining} days remaining)`);
          } else {
            console.log("👤 Creator has full access to own content");
          }
          
          // DECRYPT with REAL Seal SDK decrypt() + seal_approve - %100 REAL!
          console.log("🔓 Decrypting with REAL Seal SDK decrypt() + seal_approve...");
          
          try {
            // Find subscription NFT for seal_approve
            let subscriptionNFTId: string;
            
            if (!isCreator) {
              // Subscriber: Find their active subscription NFT
              if (!content.requiredTierId) {
                throw new Error("Missing tier ID for subscription verification");
              }
              
              const nftId = await findUserSubscriptionForTier(
                suiClient,
                account!.address,
                content.requiredTierId
              );
              
              if (!nftId) {
                throw new Error("No active subscription found");
              }
              
              subscriptionNFTId = nftId;
              console.log("✅ Found subscription NFT:", subscriptionNFTId);
            } else {
              // Creator: Use their own content ID as proof
              subscriptionNFTId = content.id;
              console.log("👤 Creator viewing own content, using content ID:", subscriptionNFTId);
            }
            
            // Initialize Seal SDK
            const sealService = await getRealSealService(suiClient);
            console.log("✅ Seal SDK initialized");
            
            // Get or create cached SessionKey (user signs ONCE, valid 28 min)
            const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";
            const sessionKey = await getOrCreateSessionKey(
              account!.address,
              PACKAGE_ID,
              suiClient,
              signPersonalMessage!
            );
            
            // Decrypt with REAL Seal SDK decrypt() + seal_approve
            console.log("🔓 Calling Seal SDK decrypt() with seal_approve...");
            
            const decryptedData = await sealService.decryptContentWithSessionKey(
              encryptedObject,
              PACKAGE_ID,
              policyId, // Use policyId as identity
              sessionKey, // SessionKey for authorization
              subscriptionNFTId, // Subscription NFT for seal_approve
              suiClient
            );
            
            console.log("✅ REAL Seal SDK decrypt() successful!", {
              decryptedSize: decryptedData.length,
              method: "100% Real @mysten/seal SDK decrypt() + seal_approve",
              sealSDK: "Real Seal SDK - NOT MOCK!",
              encryption: "IBE + BLS12-381 + AES-256-GCM",
              sealApprove: "Using real seal_approve from smart contract ✅",
              note: "GERÇEĞİ KULLANALIM BİSEY OLMAZ ✅",
            });
            
            const decryptedBlob = new Blob([new Uint8Array(decryptedData)], { type: content.contentType || 'application/octet-stream' });
            
            // If text content, decode for display
            if (content.contentType === 'text') {
              const decoder = new TextDecoder();
              const textContent = decoder.decode(new Uint8Array(decryptedData));
              setDecryptedText(textContent);
              console.log('📝 Text content decrypted:', { length: textContent.length });
            }
            
            // Fetch subscription expiry for cache sync (Real Seal path)
            let subscriptionExpiresAt: number | undefined;
            if (!isCreator && subscriptionNFTId) {
              subscriptionExpiresAt = await getSubscriptionExpiry(suiClient, subscriptionNFTId) || undefined;
            }
            
            // Cache to IndexedDB for future loads (skip decrypt next time!)
            // ✅ Cache expiry synced with subscription expiry
            await cacheDecryptedContent(
              content.id, 
              decryptedBlob, 
              content.requiredTierId,
              subscriptionExpiresAt
            ).catch(err => {
              console.warn("⚠️ Failed to cache content (non-fatal):", err);
            });
            
            const url = URL.createObjectURL(decryptedBlob);
            setContentUrl(url);
            setLoading(false);
            return;
          } catch (decryptError) {
            console.error("❌ Real Seal decrypt() failed:", decryptError);
            throw new Error(`Real Seal decrypt() failed: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`);
          }
        }
        
        // ================================================================
        // LEGACY FORMAT DECRYPTION (with symmetric key stored)
        // ================================================================
        const parts = keyData.split(':');
        let symmetricKey: Uint8Array;
        let nonce: Uint8Array;
        let storedPolicyId: string;
        
        if (parts.length === 3) {
          // Seal-powered format: IV:policyId:key
          const [ivStr, policyId, keyBytesStr] = parts;
          nonce = new Uint8Array(ivStr.split(',').map(Number));
          symmetricKey = new Uint8Array(keyBytesStr.split(',').map(Number));
          storedPolicyId = policyId;
          
          console.log("📦 Seal-powered content detected:", {
            policyId: storedPolicyId,
            nonceLength: nonce.length,
            keyLength: symmetricKey.length,
            algorithm: "AES-256-GCM (Seal DEM standard)",
            encryption: "Encrypted with Seal-powered encryption",
          });
          
          // Check if user is the creator
          const isCreator = account?.address === content.creator;
          let subscriptionNFTId: string | null = null; // Declare in outer scope for cache expiry
          let subscriptionExpiry: number | null = null;
          
          // ACCESS CONTROL: Verify subscription or creator ownership
          if (!isCreator) {
            console.log("🔐 Verifying subscription ownership...");
            
            if (!content.requiredTierId || !account?.address) {
              throw new Error("Missing required tier ID or user address");
            }
            
            subscriptionNFTId = await findUserSubscriptionForTier(
              suiClient,
              account.address,
              content.requiredTierId
            );
            
            if (!subscriptionNFTId) {
              throw new Error("No active subscription found. Please subscribe to this tier first.");
            }
            
            // ✅ CHECK EXPIRY - Frontend-side validation (legacy path)
            subscriptionExpiry = await getSubscriptionExpiry(suiClient, subscriptionNFTId);
            if (!subscriptionExpiry) {
              throw new Error("Could not verify subscription expiry");
            }
            
            const now = Date.now();
            if (now >= subscriptionExpiry) {
              const expiredDate = new Date(subscriptionExpiry).toLocaleString();
              throw new Error(`❌ Subscription expired on ${expiredDate}. Please renew to access this content.`);
            }
            
            const daysRemaining = Math.ceil((subscriptionExpiry - now) / (1000 * 60 * 60 * 24));
            console.log(`✅ Subscription active (${daysRemaining} days remaining)`);
          } else {
            console.log("👤 Creator has full access to own content");
          }
        } else if (parts.length === 2) {
          // Backward compatibility: 2-part format (policyId:key)
          // IV is prepended to encrypted data in Walrus
          const [policyId, keyBytesStr] = parts;
          symmetricKey = new Uint8Array(keyBytesStr.split(',').map(Number));
          storedPolicyId = policyId;
          
          // Extract IV from encrypted data (first 12 bytes)
          nonce = encryptedObject.slice(0, 12);
          
          console.log("📦 Backward compatibility (2 parts):", {
            policyId: storedPolicyId,
            keyLength: symmetricKey.length,
            nonceExtractedFromData: true,
          });
          
          // Check access for 2-part format content
          const isCreator = account?.address === content.creator;
          
          if (!isCreator) {
            console.log("🔐 Subscriber detected - verifying subscription");
            
            if (!content.requiredTierId || !account?.address) {
              throw new Error("Missing required tier ID or user address");
            }
            
            const subscriptionNFTId = await findUserSubscriptionForTier(
              suiClient,
              account.address,
              content.requiredTierId
            );
            
            if (!subscriptionNFTId) {
              throw new Error("No active subscription found. Please subscribe to this tier first.");
            }
            
            const isActive = await isSubscriptionActive(suiClient, subscriptionNFTId);
            if (!isActive) {
              throw new Error("Your subscription has expired. Please renew to continue.");
            }
            
            console.log("✅ Subscription verified for 2-part format content");
          }
        } else {
          throw new Error(`Invalid encryption key format (expected 2 or 3 parts, got ${parts.length} parts)`);
        }
        
        // Decrypt using the symmetric key (AES-GCM)
        try {
          // Convert to proper Uint8Array for Web Crypto API
          const keyBuffer = new Uint8Array(symmetricKey);
          const nonceBuffer = new Uint8Array(nonce);
          
          // Import the symmetric key for AES-GCM decryption
          const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyBuffer,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
          );
          
          // Prepare ciphertext: skip the nonce (first 12 bytes) from encrypted data
          const ciphertext = new Uint8Array(encryptedObject.slice(12));
          
          console.log("🔑 Decrypting with AES-GCM...", {
            nonceLength: nonceBuffer.length,
            ciphertextLength: ciphertext.length,
          });
          
          const decryptedBuffer = await crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: nonceBuffer,
            },
            cryptoKey,
            ciphertext.buffer as ArrayBuffer
          );
          
          const decryptedData = new Uint8Array(decryptedBuffer);
          
          console.log("✅ Decryption successful!", {
            decryptedSize: decryptedData.length,
          });
          
          const decryptedBlob = new Blob([decryptedData.slice()], { type: content.contentType || 'application/octet-stream' });
          
          // If text content, decode for display
          if (content.contentType === 'text') {
            const decoder = new TextDecoder();
            const textContent = decoder.decode(decryptedData.slice());
            setDecryptedText(textContent);
            console.log('📝 Text content decrypted (legacy):', { length: textContent.length });
          }
          
          // Cache to IndexedDB for future loads
          // ✅ Cache expiry synced with subscription expiry (already fetched above)
          await cacheDecryptedContent(
            content.id, 
            decryptedBlob, 
            content.requiredTierId,
            subscriptionExpiry || undefined // Use the expiry we already fetched
          ).catch(err => {
            console.warn("⚠️ Failed to cache content (non-fatal):", err);
          });
          
          const url = URL.createObjectURL(decryptedBlob);
          setContentUrl(url);
          
        } catch (decryptError) {
          console.error("❌ Decryption failed:", decryptError);
          throw new Error(`Decryption failed: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      console.error("Content load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied to clipboard!");
  };

  if (!hasAccess && !content.isPublic) {
    // Show blurred preview if enabled
    if (showLockedPreview) {
      return (
        <div className="bg-white rounded-lg overflow-hidden relative">
          {/* Blurred Content Preview */}
          <div className="relative">
            {/* Placeholder blurred image */}
            <div className="w-full h-64 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 blur-xl" />
            
            {/* Lock Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center text-white p-6">
                <div className="bg-white/20 backdrop-blur-md rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">🔒 Locked Content</h3>
                {requiredTierName && (
                  <p className="text-sm mb-3">
                    Subscribe to <span className="font-semibold">{requiredTierName}</span> tier to unlock
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Content Info */}
          <div className="p-4 border-t">
            <h4 className="font-semibold text-gray-900 mb-1">{content.title}</h4>
            {content.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{content.description}</p>
            )}
          </div>
        </div>
      );
    }
    
    // Full locked view (for non-compact mode)
    return (
      <div className="bg-white">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{content.title}</h3>
              {createdAt && (
                <p className="text-sm text-gray-500">{createdAt}</p>
              )}
              {requiredTierName && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                    {requiredTierName} Tier Required
                  </span>
                </div>
              )}
            </div>
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Locked
            </span>
          </div>
          {content.description && (
            <p className="text-gray-600 text-sm line-clamp-2">{content.description}</p>
          )}
        </div>

        {/* Locked Content Area */}
        <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-12 text-center">
          <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 shadow-md">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">🔒 Join to unlock</h3>
          {requiredTierName ? (
            <p className="text-gray-600 mb-6">
              Subscribe to the <strong>{requiredTierName}</strong> tier to access this content
            </p>
          ) : (
            <p className="text-gray-600 mb-6">Subscribe to access this content</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button disabled className="flex items-center gap-2 text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-sm">{likes}</span>
            </button>
            <button disabled className="flex items-center gap-2 text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="text-sm">{comments}</span>
            </button>
          </div>
          <button onClick={handleShare} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-sm">Share</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Loading secure content...</p>
        <p className="text-gray-500 text-sm mt-2">
          🔐 You may be asked to sign once per session for security
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg p-8 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadContent}
          className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!contentUrl) {
    return null;
  }

  return (
    <div className="bg-white">
      {/* Header - Hidden in compact mode */}
      {!compact && (
        <div className="p-6 border-b">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{content.title}</h3>
              {createdAt && (
                <p className="text-sm text-gray-500">{createdAt}</p>
              )}
            </div>
            {!content.isPublic && (
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                Exclusive
              </span>
            )}
          </div>
          {content.description && (
            <p className="text-gray-600 text-sm">{content.description}</p>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="bg-gray-900">
        {content.contentType === "image" && (
          <img
            src={contentUrl}
            alt={content.title}
            className={compact ? "w-full h-48 object-cover" : "w-full max-h-[600px] object-contain"}
          />
        )}
        
        {content.contentType === "video" && (
          <video
            src={contentUrl}
            controls={!compact}
            className={compact ? "w-full h-48 object-cover" : "w-full max-h-[600px]"}
          />
        )}
        
        {content.contentType === "audio" && (
          <div className={compact ? "p-4" : "p-8"}>
            <div className="flex items-center justify-center h-full">
              <svg className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} text-white mb-2`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            {!compact && (
              <audio
                src={contentUrl}
                controls
                className="w-full"
              />
            )}
          </div>
        )}
        
        {content.contentType === "text" && (
          <div className={compact ? "p-4" : "p-8"}>
            <div className="bg-white rounded-lg p-6 max-w-4xl mx-auto">
              <div className="prose prose-lg max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 font-serif leading-relaxed">
                  {decryptedText || "Loading text..."}
                </div>
              </div>
              {!compact && decryptedText && (
                <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-500 mb-3">
                    📝 {decryptedText.split(/\s+/).length} words · {decryptedText.length} characters
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(decryptedText);
                      alert("Text copied to clipboard!");
                    }}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Text
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {(content.contentType === "file" || content.contentType === "media") && (
          <div className={compact ? "p-4 text-center" : "p-12 text-center"}>
            <div className="bg-white rounded-lg inline-block p-4">
              <svg className={`${compact ? 'w-8 h-8' : 'w-16 h-16'} text-blue-600 mx-auto mb-2`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {!compact && (
                <a
                  href={contentUrl}
                  download={content.title}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold transition"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download File
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions - Hidden in compact mode */}
      {!compact && (
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={handleLike}
              className={`flex items-center gap-2 transition ${
                isLiked ? 'text-red-600' : 'text-gray-600 hover:text-red-600'
              }`}
            >
              <svg className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} fill={isLiked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span className="text-sm font-medium">{likes}</span>
            </button>
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="text-sm font-medium">{comments}</span>
            </button>
          </div>
          <button onClick={handleShare} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      )}
    </div>
  );
}

