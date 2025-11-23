/**
 * Subscription Access Proof for Seal Decryption
 * 
 * This module creates transaction proofs that demonstrate a user's
 * subscription ownership, which are required by Seal SDK for decryption.
 */

import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

export interface CreatorProfileInfo {
  profileId: string;
  owner: string;
}

export interface SubscriptionProofResult {
  txBytes: Uint8Array;
  subscriptionNFTId: string;
  tierId: string;
  contentId: string;
}

/**
 * Creates a subscription proof transaction for Seal decryption
 * 
 * @param suiClient - Sui client instance
 * @param subscriptionNFTId - The subscription NFT object ID
 * @param contentId - The content ID to access
 * @param walletAddress - The user's wallet address
 * @param clockObjectId - The Sui Clock object ID (0x6)
 * @returns Transaction bytes that can be used as proof for Seal SDK
 */
export async function createSubscriptionProof(
  suiClient: SuiClient,
  subscriptionNFTId: string,
  contentId: string,
  walletAddress: string,
  clockObjectId: string = "0x0000000000000000000000000000000000000000000000000000000000000006"
): Promise<SubscriptionProofResult> {
  const tx = new Transaction();

  // Call the create_access_proof function
  tx.moveCall({
    target: `${PACKAGE_ID}::subscription::create_access_proof`,
    arguments: [
      tx.object(subscriptionNFTId),
      tx.pure.id(contentId),
      tx.object(clockObjectId),
    ],
  });

  // Set sender
  tx.setSender(walletAddress);

  // Build transaction bytes WITHOUT executing
  const txBytes = await tx.build({ client: suiClient });

  return {
    txBytes,
    subscriptionNFTId,
    tierId: "", // Will be filled from subscription object
    contentId,
  };
}

/**
 * Creates a creator access proof transaction for Seal decryption
 * Creators can access their own content without subscriptions
 * 
 * @param suiClient - Sui client instance
 * @param profileId - The creator's profile ID
 * @param contentId - The content ID to access
 * @param walletAddress - The creator's wallet address
 * @returns Transaction bytes that can be used as proof for Seal SDK
 */
export async function createCreatorAccessProof(
  suiClient: SuiClient,
  profileId: string,
  contentId: string,
  walletAddress: string
): Promise<SubscriptionProofResult> {
  const tx = new Transaction();

  // Call the create_creator_access_proof function
  tx.moveCall({
    target: `${PACKAGE_ID}::subscription::create_creator_access_proof`,
    arguments: [
      tx.object(profileId),
      tx.pure.id(contentId),
    ],
  });

  // Set sender
  tx.setSender(walletAddress);

  // Build transaction bytes WITHOUT executing
  const txBytes = await tx.build({ client: suiClient });

  console.log("✅ Created creator access proof:", {
    profileId,
    contentId,
    txBytesLength: txBytes.length,
  });

  return {
    txBytes,
    subscriptionNFTId: profileId, // Use profile ID as placeholder
    tierId: profileId,
    contentId,
  };
}

/**
 * Finds a user's subscription NFT for a specific tier
 * 
 * @param suiClient - Sui client instance
 * @param userAddress - The user's wallet address
 * @param tierId - The tier ID to find subscription for
 * @returns The subscription NFT object ID, or null if not found
 */
export async function findUserSubscriptionForTier(
  suiClient: SuiClient,
  userAddress: string,
  tierId: string
): Promise<string | null> {
  try {
    // Get all objects owned by user
    const objects = await suiClient.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${PACKAGE_ID}::subscription::Subscription`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    console.log(`🔍 Found ${objects.data.length} subscription(s) for user`);

    // Find the subscription that matches the tier
    for (const obj of objects.data) {
      if (obj.data?.content?.dataType === "moveObject") {
        const fields = obj.data.content.fields as any;
        
        if (fields.tier_id === tierId) {
          console.log(`✅ Found matching subscription: ${obj.data.objectId}`);
          return obj.data.objectId;
        }
      }
    }

    console.log(`❌ No subscription found for tier: ${tierId}`);
    return null;
  } catch (error) {
    console.error("Error finding subscription:", error);
    return null;
  }
}

/**
 * Verifies if a subscription is still active
 * 
 * @param suiClient - Sui client instance
 * @param subscriptionId - The subscription NFT object ID
 * @returns True if subscription is active, false otherwise
 */
export async function isSubscriptionActive(
  suiClient: SuiClient,
  subscriptionId: string
): Promise<boolean> {
  try {
    const obj = await suiClient.getObject({
      id: subscriptionId,
      options: { showContent: true },
    });

    if (obj.data?.content?.dataType === "moveObject") {
      const fields = obj.data.content.fields as any;
      const expiresAt = parseInt(fields.expires_at);
      const now = Date.now();

      const isActive = now < expiresAt;
      console.log(`⏰ Subscription active: ${isActive} (expires: ${new Date(expiresAt).toISOString()})`);
      
      return isActive;
    }

    return false;
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return false;
  }
}

/**
 * Get subscription expiry timestamp
 * Returns expiry timestamp in milliseconds, or null if not found
 */
export async function getSubscriptionExpiry(
  suiClient: SuiClient,
  subscriptionId: string
): Promise<number | null> {
  try {
    const obj = await suiClient.getObject({
      id: subscriptionId,
      options: { showContent: true },
    });

    if (obj.data?.content?.dataType === "moveObject") {
      const fields = obj.data.content.fields as any;
      const expiresAt = parseInt(fields.expires_at);
      
      console.log(`📅 Subscription expires at: ${new Date(expiresAt).toLocaleString()}`);
      
      return expiresAt;
    }

    return null;
  } catch (error) {
    console.error("Error getting subscription expiry:", error);
    return null;
  }
}

/**
 * Finds creator's profile ID
 * 
 * @param suiClient - Sui client instance
 * @param creatorAddress - The creator's wallet address
 * @returns The creator's profile ID, or null if not found
 */
export async function findCreatorProfile(
  suiClient: SuiClient,
  creatorAddress: string
): Promise<string | null> {
  try {
    // Query for ProfileCreated events
    const events = await suiClient.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
      },
      limit: 50,
    });

    // Find profile for this creator
    for (const event of events.data) {
      const data = event.parsedJson as any;
      if (data.owner === creatorAddress) {
        console.log(`✅ Found creator profile: ${data.profile_id}`);
        return data.profile_id;
      }
    }

    console.log(`❌ No profile found for creator: ${creatorAddress}`);
    return null;
  } catch (error) {
    console.error("Error finding creator profile:", error);
    return null;
  }
}

