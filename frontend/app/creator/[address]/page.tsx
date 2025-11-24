"use client";

import { use, useState, useEffect } from "react";
import { WalletButton } from "@/components/auth/WalletButton";
import { SubscriptionCard } from "@/components/payment/SubscriptionCard";
import { TipButton } from "@/components/payment/TipButton";
import { ContentViewer } from "@/components/content/ContentViewer";
import { useCurrentAccount } from "@mysten/dapp-kit";
import Link from "next/link";
import { suiClient } from "@/lib/sui/client";
import { PACKAGE_ID } from "@/lib/sui/config";
import { resolveNameToAddress, isSuiNSName } from "@/lib/suins/client";

interface CreatorProfile {
  id: string;
  address: string;
  handle: string;
  bio: string;
  profileImage?: string;
  bannerImage?: string;
  suinsName?: string;
}

interface Tier {
  id: string;
  name: string;
  description: string;
  pricePerMonth: string;
  currentSubscribers: number;
  maxSubscribers: number;
}

interface Content {
  id: string;
  title: string;
  description: string;
  walrusBlobId: string;
  sealPolicyId: string;
  isPublic: boolean;
  contentType: string;
  creator: string;
  encryptionKey?: string;
  requiredTierId?: string;
}

export default function CreatorProfile({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: addressOrSuiNS } = use(params);
  const currentAccount = useCurrentAccount();
  const [loading, setLoading] = useState(true);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [userSubscribedTiers, setUserSubscribedTiers] = useState<Set<string>>(new Set());

  // Resolve SuiNS name or handle to address
  useEffect(() => {
    const resolveAddress = async () => {
      // Check if it's a SuiNS name (.sui)
      if (isSuiNSName(addressOrSuiNS)) {
        console.log('🔍 Resolving SuiNS name:', addressOrSuiNS);
        const addr = await resolveNameToAddress(addressOrSuiNS, suiClient);
        if (addr) {
          console.log('✅ SuiNS resolved to:', addr);
          setResolvedAddress(addr);
        } else {
          console.log('❌ SuiNS name not found');
          setResolvedAddress(null);
        }
      } 
      // Check if it's an address (starts with 0x)
      else if (addressOrSuiNS.startsWith('0x')) {
        console.log('📍 Using address directly:', addressOrSuiNS);
        setResolvedAddress(addressOrSuiNS);
      }
      // Otherwise, treat it as a handle/username
      else {
        console.log('👤 Looking up handle:', addressOrSuiNS);
        try {
          // Fetch all profiles and find by handle
          const profileEvents = await suiClient.queryEvents({
            query: {
              MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
            },
            limit: 100,
          });

          const matchingProfile = profileEvents.data.find(
            (event: any) => event.parsedJson?.handle === addressOrSuiNS
          );

          if (matchingProfile && matchingProfile.parsedJson) {
            const addr = (matchingProfile.parsedJson as any).owner;
            console.log('✅ Handle resolved to:', addr);
            setResolvedAddress(addr);
          } else {
            console.log('❌ Handle not found');
            setResolvedAddress(null);
          }
        } catch (error) {
          console.error('❌ Error looking up handle:', error);
          setResolvedAddress(null);
        }
      }
    };
    
    resolveAddress();
  }, [addressOrSuiNS]);

  useEffect(() => {
    if (resolvedAddress) {
    fetchCreatorData();
    }
  }, [resolvedAddress]);

  useEffect(() => {
    if (currentAccount?.address && tiers.length > 0) {
      console.log("🔄 Checking user subscriptions (triggered by account or tiers change)");
      checkUserSubscriptions();
    } else {
      // Clear subscriptions if user disconnects
      if (!currentAccount?.address) {
        setUserSubscribedTiers(new Set());
      }
    }
  }, [currentAccount?.address, tiers, resolvedAddress]);

  const fetchCreatorData = async () => {
    if (!resolvedAddress) return;
    
    setLoading(true);
    try {
      // Fetch profile
      const profileEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
        },
        limit: 50,
      });

      const creatorProfile = profileEvents.data.find(
        (event: any) => event.parsedJson?.owner === resolvedAddress
      );

      if (creatorProfile) {
        const data = creatorProfile.parsedJson as any;
        const profileId = data.profile_id;
        
        // Fetch full profile object to get images
        const profileObj = await suiClient.getObject({
          id: profileId,
          options: { showContent: true },
        });

        let profileImage = "";
        let bannerImage = "";
        let suinsName = "";
        let bio = "Creator on Walron";
        let handle = data.handle || data.owner.slice(0, 8);

        if (profileObj.data?.content?.dataType === "moveObject") {
          const fields = profileObj.data.content.fields as any;
          profileImage = fields.profile_image_blob_id || "";
          bannerImage = fields.banner_image_blob_id || "";
          suinsName = fields.suins_name || "";
          bio = fields.bio || "Creator on Walron";
          handle = fields.handle || handle;
        }

        setProfile({
          id: profileId,
          address: data.owner,
          handle,
          bio,
          profileImage,
          bannerImage,
          suinsName,
        });
      }

      // Fetch tiers
      const tierEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::subscription::TierCreated`,
        },
        limit: 50,
      });

      // Remove duplicates by tier_id
      const uniqueTiers = new Map();
      tierEvents.data
        .filter((event: any) => event.parsedJson?.creator === resolvedAddress)
        .forEach((event: any) => {
          const data = event.parsedJson;
          if (!uniqueTiers.has(data.tier_id)) {
            uniqueTiers.set(data.tier_id, {
              id: data.tier_id,
              name: data.name,
              description: data.description || "Subscription tier",
              pricePerMonth: (parseInt(data.price) / 1e9).toString(),
              currentSubscribers: 0,
              maxSubscribers: parseInt(data.max_subscribers),
            });
          }
        });

      setTiers(Array.from(uniqueTiers.values()));

      // Fetch content
      const contentEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::content::ContentCreated`,
        },
        limit: 50,
      });

      const creatorContentEvents = contentEvents.data.filter(
        (event: any) => event.parsedJson?.creator === resolvedAddress
      );

      // Fetch full content objects to get walrus_blob_id
      const creatorContent = await Promise.all(
        creatorContentEvents.map(async (event: any) => {
          const data = event.parsedJson;
          try {
            const contentObject = await suiClient.getObject({
              id: data.content_id,
              options: { showContent: true },
            });

            const fields = (contentObject.data?.content as any)?.fields || {};
            
            // Skip archived content
            if (fields.is_archived === true) {
              return null;
            }
            
            return {
              id: data.content_id,
              title: data.title || fields.title || "Untitled",
              isPublic: data.is_public,
              contentType: fields.content_type || "media",
              creator: resolvedAddress,
              walrusBlobId: fields.walrus_blob_id || "",
              encryptionKey: fields.encryption_key || "",
              sealPolicyId: fields.seal_policy_id || "",
              description: fields.description || "",
              requiredTierId: fields.required_tier_id || "",
            };
          } catch (error) {
            console.error(`Error fetching content object ${data.content_id}:`, error);
            return null;
          }
        })
      );

      setContent(creatorContent.filter((c) => c !== null));
    } catch (error) {
      console.error("Error fetching creator data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserSubscriptions = async () => {
    if (!currentAccount?.address) {
      console.log("⚠️ No wallet connected, skipping subscription check");
      return;
    }

    if (tiers.length === 0) {
      console.log("⚠️ No tiers loaded yet, will retry when tiers are available");
      return;
    }

    try {
      console.log("🔍 Checking subscriptions for:", currentAccount.address);
      console.log("📦 Using PACKAGE_ID:", PACKAGE_ID);
      console.log("🎯 Looking for subscriptions to tiers:", tiers.map(t => ({
        id: t.id.slice(0, 10) + '...',
        name: t.name
      })));
      
      // Get user's owned objects (Subscription NFTs)
      const ownedObjects = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        options: {
          showType: true,
          showContent: true,
        },
      });

      console.log("📋 Total owned objects:", ownedObjects.data.length);

      // Find Subscription NFTs
      const userTierIds = new Set<string>();
      let subscriptionCount = 0;
      
      ownedObjects.data.forEach((obj: any) => {
        const type = obj.data?.type;
        
        // Check if this is a Subscription NFT
        if (type?.includes(`${PACKAGE_ID}::subscription::Subscription`)) {
          subscriptionCount++;
          const fields = (obj.data?.content as any)?.fields;
          console.log(`✅ Found Subscription NFT #${subscriptionCount}:`, {
            objectId: obj.data?.objectId,
            tierId: fields?.tier_id,
            subscriber: fields?.subscriber,
            expiresAt: fields?.expires_at,
            allFields: fields
          });
          
          if (fields?.tier_id) {
            userTierIds.add(fields.tier_id);
            console.log("🎟️ Added subscription to tier:", fields.tier_id);
            
            // Check if this tier is in our current tier list
            const matchingTier = tiers.find(t => t.id === fields.tier_id);
            if (matchingTier) {
              console.log("✅ Subscription matches tier:", matchingTier.name);
            } else {
              console.log("⚠️ Subscription tier not found in current tier list");
            }
          } else {
            console.log("⚠️ Subscription NFT missing tier_id field");
          }
        }
      });

      setUserSubscribedTiers(userTierIds);
      console.log("✅ User subscribed to tiers:", Array.from(userTierIds).map(id => id.slice(0, 10) + '...'));
      console.log("📊 Total subscriptions found:", userTierIds.size);
      
      if (userTierIds.size === 0 && subscriptionCount === 0) {
        console.log("ℹ️ No subscriptions found for this user");
      }
    } catch (error) {
      console.error("❌ Error checking subscriptions:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/walrus-loading.jpg" 
            alt="Loading..." 
            className="w-32 h-32 object-cover rounded-full animate-bounce mx-auto shadow-lg"
          />
          <p className="mt-4 text-xl font-semibold text-gray-700">Loading creator profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-transparent">
        <header className="border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex justify-between items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-white tracking-tight flex-shrink-0">
                <img 
                  src="/walron.JPG" 
                  alt="Walron Logo" 
                  className="w-8 h-8 object-contain rounded-lg"
                />
                <span className="hidden sm:inline">Walron</span>
              </Link>
              <nav className="flex items-center gap-3 sm:gap-6">
                <Link href="/explore" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium transition-colors whitespace-nowrap">
                  Explore
                </Link>
                <Link href="/dashboard" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium transition-colors whitespace-nowrap">
                  Dashboard
                </Link>
                <div className="flex-shrink-0">
                  <WalletButton />
                </div>
              </nav>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Creator not found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">This creator hasn't set up their profile yet.</p>
          <Link
            href="/explore"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Explore Creators
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
        {/* Header */}
        <header className="border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <div className="flex justify-between items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-white tracking-tight flex-shrink-0">
                <img 
                  src="/walron.JPG" 
                  alt="Walron Logo" 
                  className="w-8 h-8 object-contain rounded-lg"
                />
                <span className="hidden sm:inline">Walron</span>
              </Link>
              <nav className="flex items-center gap-3 sm:gap-6">
                <Link href="/explore" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium transition-colors whitespace-nowrap">
                  Explore
                </Link>
                <Link href="/dashboard" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium transition-colors whitespace-nowrap">
                  Dashboard
                </Link>
                <div className="flex-shrink-0">
                  <WalletButton />
                </div>
              </nav>
            </div>
          </div>
        </header>

        {/* Banner */}
        {profile.bannerImage && profile.bannerImage.trim() !== '' ? (
          <div 
            className="h-48 bg-cover bg-center"
            style={{
              backgroundImage: `url(https://aggregator.walrus-testnet.walrus.space/v1/blobs/${profile.bannerImage})`
            }}
          />
        ) : (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-48" />
        )}

        <div className="container mx-auto px-4">
          {/* Profile Section */}
          <section className="mb-12 mt-8">
            <h2 className="text-2xl font-bold text-white dark:text-white mb-6">Profile</h2>
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-lg p-8 border border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-6">
                {/* Profile Image */}
                {profile.profileImage && profile.profileImage.trim() !== '' ? (
                  <img
                    src={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${profile.profileImage}`}
                    alt={profile.handle}
                    className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-4xl border-4 border-white dark:border-slate-800 shadow-lg">
                  {profile.handle[0].toUpperCase()}
                </div>
                )}
                
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">@{profile.handle}</h1>
                    {profile.suinsName && (
                      <span className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {profile.suinsName}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">{profile.bio}</p>
                  
                  <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400 mb-4">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {content.length}
                      </span>{" "}
                      posts
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {tiers.length}
                      </span>{" "}
                      tiers
                    </div>
                  </div>

                  {resolvedAddress && (
                  <TipButton
                      creatorAddress={resolvedAddress}
                    profileId={profile.id}
                  />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Subscription Tiers */}
          {tiers.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-white dark:text-white mb-6">Subscription Tiers</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {tiers.map((tier) => (
                  <SubscriptionCard
                    key={tier.id}
                    tier={tier}
                    profileId={profile.id}
                    isSubscribed={userSubscribedTiers.has(tier.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Content Feed */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white dark:text-white mb-6">Content</h2>
            {content.length === 0 ? (
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-md p-12 text-center border border-slate-100 dark:border-slate-800">
                <p className="text-slate-600 dark:text-slate-400">No content posted yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {content.map((item) => {
                  // Determine if user has access to this content
                  const isCreator = currentAccount?.address === resolvedAddress;
                  
                  // Check if user has subscribed to the required tier for this content
                  const hasRequiredTier = item.requiredTierId 
                    ? userSubscribedTiers.has(item.requiredTierId)
                    : false;
                  
                  // Access granted if: public, creator, or has required tier subscription
                  const hasAccess = item.isPublic || isCreator || hasRequiredTier;
                  
                  // Find the tier name for this content
                  const requiredTier = tiers.find(t => t.id === item.requiredTierId);

                  // Debug log for each content item
                  console.log(`🎬 Content: "${item.title}"`, {
                    contentId: item.id.slice(0, 10) + '...',
                    isPublic: item.isPublic,
                    requiredTierId: item.requiredTierId ? item.requiredTierId.slice(0, 10) + '...' : 'none',
                    isCreator,
                    hasRequiredTier,
                    hasAccess: hasAccess ? '✅' : '🔒',
                    userSubscriptions: Array.from(userSubscribedTiers).map(id => id.slice(0, 10) + '...')
                  });

                  return (
                    <div key={item.id} className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg shadow-md overflow-hidden border border-slate-100 dark:border-slate-800">
                      <ContentViewer
                        content={item}
                        hasAccess={hasAccess}
                        requiredTierName={requiredTier?.name}
                        showLockedPreview={!hasAccess && !item.isPublic}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
  );
}

