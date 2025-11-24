"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/auth/WalletButton";
import { suiClient } from "@/lib/sui/client";
import { PACKAGE_ID } from "@/lib/sui/config";
import { resolveAddressToName } from "@/lib/suins/client";

interface Creator {
  address: string;
  handle: string;
  bio: string;
  profileId: string;
  contentCount: number;
  suinsName?: string | null; // SuiNS name if available
}

export default function Explore() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAllCreators();
  }, []);

  const fetchAllCreators = async () => {
    setLoading(true);
    try {
      // Fetch all ProfileCreated events
      const profileEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
        },
        limit: 50,
        order: "descending",
      });

      // Fetch all ContentCreated events to count content per creator
      const contentEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::content::ContentCreated`,
        },
        limit: 100,
        order: "descending",
      });

      // Count content per creator
      const contentCountMap: Record<string, number> = {};
      contentEvents.data.forEach((event: any) => {
        const creator = event.parsedJson?.creator;
        if (creator) {
          contentCountMap[creator] = (contentCountMap[creator] || 0) + 1;
        }
      });

      // Map profiles to creators
      const creatorsList: Creator[] = await Promise.all(
        profileEvents.data.map(async (event: any) => {
        const data = event.parsedJson;
          const address = data.owner;
          const profileId = data.profile_id;
          
          // Fetch full profile object to get bio and images
          let bio = "Creator on Walron";
          let handle = data.handle || address.slice(0, 8);
          
          try {
            const profileObj = await suiClient.getObject({
              id: profileId,
              options: { showContent: true },
            });

            if (profileObj.data?.content?.dataType === "moveObject") {
              const fields = profileObj.data.content.fields as any;
              bio = fields.bio || bio;
              handle = fields.handle || handle;
            }
          } catch (error) {
            console.log(`Could not fetch profile details for ${address.slice(0, 8)}...`);
          }
          
          // Resolve SuiNS name for each creator
          let suinsName: string | null = null;
          try {
            suinsName = await resolveAddressToName(address, suiClient);
          } catch (error) {
            console.log(`Could not resolve SuiNS for ${address.slice(0, 8)}...`);
          }
          
        return {
            address,
            handle,
            bio,
            profileId,
            contentCount: contentCountMap[address] || 0,
            suinsName,
        };
        })
      );

      setCreators(creatorsList);
      console.log("Fetched creators:", creatorsList);
    } catch (error) {
      console.error("Error fetching creators:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCreators = creators.filter(
    (creator) =>
      creator.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.bio.toLowerCase().includes(searchQuery.toLowerCase())
  );
  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-blue-600">
                <img 
                  src="/walron.JPG" 
                  alt="Walron Logo" 
                  className="w-8 h-8 object-contain"
                />
                Walron
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900 font-medium"
                >
                  Dashboard
                </Link>
                <WalletButton />
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Explore Creators</h1>
            <p className="text-gray-600">
              Discover amazing creators and support their work
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <input
              type="text"
              placeholder="Search creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-2xl border border-gray-300 rounded-lg p-4 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <img 
                src="/walrus-loading.jpg" 
                alt="Loading..." 
                className="w-28 h-28 object-cover rounded-full animate-bounce mx-auto shadow-lg"
              />
              <p className="mt-4 text-xl font-semibold text-gray-700">Loading creators...</p>
            </div>
          ) : filteredCreators.length === 0 ? (
            <div className="text-center bg-white rounded-lg shadow-md p-12">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? "No creators found" : "No creators yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? "Try a different search term"
                  : "Be the first creator on Walron!"}
              </p>
              <Link
                href="/dashboard"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Start Creating
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredCreators.map((creator) => {
                // Priority: SuiNS name > handle > address
                const creatorUrl = creator.suinsName || creator.handle || creator.address;
                
                return (
                <Link
                  key={creator.address}
                  href={`/creator/${creatorUrl}`}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xl">
                      {creator.handle[0].toUpperCase()}
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-bold text-lg text-gray-900 mb-1">
                        @{creator.handle}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {creator.bio}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {creator.contentCount}
                      </span>{" "}
                      posts
                    </div>
                    {creator.suinsName ? (
                      <div className="text-xs text-blue-600 font-medium truncate flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {creator.suinsName}
                      </div>
                    ) : (
                    <div className="text-xs text-gray-500 truncate">
                      {creator.address.slice(0, 6)}...{creator.address.slice(-4)}
                    </div>
                    )}
                  </div>
                </Link>
              )})}
            </div>
          )}

        </div>
      </div>
  );
}

