"use client";

import { use, useState, useEffect } from "react";
import { WalletButton } from "@/components/auth/WalletButton";
import { SubscriptionCard } from "@/components/payment/SubscriptionCard";
import { TipButton } from "@/components/payment/TipButton";
import { ContentViewer } from "@/components/content/ContentViewer";
import Link from "next/link";
import { suiClient } from "@/lib/sui/client";
import { PACKAGE_ID } from "@/lib/sui/config";

interface CreatorProfile {
  id: string;
  address: string;
  handle: string;
  bio: string;
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
  description?: string;
  walrusBlobId?: string;
  sealPolicyId?: string;
  isPublic: boolean;
  contentType: string;
  creator: string;
}

export default function CreatorProfile({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [content, setContent] = useState<Content[]>([]);

  useEffect(() => {
    fetchCreatorData();
  }, [address]);

  const fetchCreatorData = async () => {
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
        (event: any) => event.parsedJson?.owner === address
      );

      if (creatorProfile) {
        const data = creatorProfile.parsedJson as any;
        setProfile({
          id: data.profile_id,
          address: data.owner,
          handle: data.handle || data.owner.slice(0, 8),
          bio: data.bio || "Creator on Web3 Patreon",
        });
      }

      // Fetch tiers
      const tierEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::subscription::TierCreated`,
        },
        limit: 50,
      });

      const creatorTiers = tierEvents.data
        .filter((event: any) => event.parsedJson?.creator === address)
        .map((event: any) => {
          const data = event.parsedJson;
          return {
            id: data.tier_id,
            name: data.name,
            description: data.description || "Subscription tier",
            pricePerMonth: (parseInt(data.price) / 1e9).toString(),
            currentSubscribers: 0,
            maxSubscribers: parseInt(data.max_subscribers),
          };
        });

      setTiers(creatorTiers);

      // Fetch content
      const contentEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::content::ContentCreated`,
        },
        limit: 50,
      });

      const creatorContent = contentEvents.data
        .filter((event: any) => event.parsedJson?.creator === address)
        .map((event: any) => {
          const data = event.parsedJson;
          return {
            id: data.content_id,
            title: data.title,
            isPublic: data.is_public,
            contentType: "media",
            creator: address,
          };
        });

      setContent(creatorContent);
    } catch (error) {
      console.error("Error fetching creator data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading creator profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Link href="/" className="text-2xl font-bold text-blue-600">
                Web3 Patreon
              </Link>
              <WalletButton />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Creator not found</h1>
          <p className="text-gray-600 mb-6">This creator hasn't set up their profile yet.</p>
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
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Link href="/" className="text-2xl font-bold text-blue-600">
                Web3 Patreon
              </Link>
              <WalletButton />
            </div>
          </div>
        </header>

        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-48" />

        <div className="container mx-auto px-4">
          {/* Profile Section */}
          <div className="relative -mt-20 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-4xl">
                  {profile.handle[0].toUpperCase()}
                </div>
                
                <div className="flex-grow">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">@{profile.handle}</h1>
                  <p className="text-gray-600 mb-4">{profile.bio}</p>
                  
                  <div className="flex gap-6 text-sm text-gray-600 mb-4">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {content.length}
                      </span>{" "}
                      posts
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">
                        {tiers.length}
                      </span>{" "}
                      tiers
                    </div>
                  </div>

                  <TipButton
                    creatorAddress={address}
                    profileId={profile.id}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Tiers */}
          {tiers.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Subscription Tiers</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {tiers.map((tier) => (
                  <SubscriptionCard
                    key={tier.id}
                    tier={tier}
                    profileId={profile.id}
                    isSubscribed={false}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Content Feed */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Content</h2>
            {content.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-600">No content posted yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {content.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <ContentViewer
                      content={item}
                      hasAccess={item.isPublic}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
  );
}

