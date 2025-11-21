"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { WalletButton } from "@/components/auth/WalletButton";
import { ContentUploader } from "@/components/creator/ContentUploader";
import { ContentViewer } from "@/components/content/ContentViewer";
import { PACKAGE_ID } from "@/lib/sui/config";
import { suiClient } from "@/lib/sui/client";
import Link from "next/link";

export default function Dashboard() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [loading, setLoading] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [creatingTier, setCreatingTier] = useState(false);
  const [tiers, setTiers] = useState<Array<{ id: string; name: string }>>([]);
  const [myContent, setMyContent] = useState<Array<{
    content_id: string;
    title: string;
    is_public: boolean;
    walrus_blob_id: string;
    seal_policy_id: string;
    description: string;
    content_type: string;
    is_archived: boolean;
  }>>([]);
  
  // Form states
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [tierName, setTierName] = useState("");
  const [tierDescription, setTierDescription] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [maxSubscribers, setMaxSubscribers] = useState("100");
  
  // Edit/Delete modal states
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Archive/Unarchive states
  const [showArchived, setShowArchived] = useState(false);
  const [archivedContent, setArchivedContent] = useState<Array<{
    content_id: string;
    title: string;
    is_public: boolean;
    walrus_blob_id: string;
    seal_policy_id: string;
    description: string;
    content_type: string;
    is_archived: boolean;
  }>>([]);

  // Auto-fetch creator profile on mount
  useEffect(() => {
    if (account?.address) {
      fetchCreatorProfile();
    }
  }, [account?.address]);

  const fetchCreatorProfile = async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      // Query for ProfileCreated events from this user
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
        },
        limit: 50,
      });

      // Find this user's profile
      const userProfileEvent = events.data.find(
        (event: any) => event.parsedJson?.owner === account.address
      );

      if (userProfileEvent && userProfileEvent.parsedJson) {
        const eventData = userProfileEvent.parsedJson as any;
        const profileIdFromEvent = eventData.profile_id;
        console.log("Found profile:", profileIdFromEvent);
        setProfileId(profileIdFromEvent);
        setHasProfile(true);
        
        // Fetch existing tiers for this profile
        await fetchTiers(profileIdFromEvent);
        // Fetch user's content
        await fetchMyContent();
      } else {
        console.log("No profile found for this wallet");
        setHasProfile(false);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyContent = async () => {
    if (!account?.address) return;
    
    try {
      // Query for ContentCreated events from this user
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::content::ContentCreated`,
        },
        limit: 50,
      });

      // Filter content created by this user
      const userContentEvents = events.data.filter(
        (event: any) => event.parsedJson?.creator === account.address
      );

      // Fetch full content objects
      const userContentWithDetails = await Promise.all(
        userContentEvents.map(async (event: any) => {
          const data = event.parsedJson;
          try {
            const contentObject = await suiClient.getObject({
              id: data.content_id,
              options: { showContent: true },
            });

            const fields = (contentObject.data?.content as any)?.fields || {};
            
            return {
              content_id: data.content_id,
              title: data.title || fields.title || "Untitled",
              is_public: data.is_public,
              walrus_blob_id: fields.walrus_blob_id || "",
              seal_policy_id: fields.seal_policy_id || "",
              description: fields.description || "",
              content_type: fields.content_type || "media",
              is_archived: fields.is_archived || false,
            };
          } catch (error) {
            console.error(`Error fetching content ${data.content_id}:`, error);
            return {
              content_id: data.content_id,
              title: data.title,
              is_public: data.is_public,
              walrus_blob_id: "",
              seal_policy_id: "",
              description: "",
              content_type: "media",
              is_archived: false,
            };
          }
        })
      );

      // Separate active and archived content
      const activeContent = userContentWithDetails.filter(c => !c.is_archived);
      const archivedContentList = userContentWithDetails.filter(c => c.is_archived);
      
      setMyContent(activeContent);
      setArchivedContent(archivedContentList);
      console.log("Found active content:", activeContent);
      console.log("Found archived content:", archivedContentList);
    } catch (error) {
      console.error("Error fetching content:", error);
    }
  };

  const fetchTiers = async (profileId: string) => {
    try {
      // Query for TierCreated events for this profile
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::subscription::TierCreated`,
        },
        limit: 50,
      });

      // Filter tiers for this creator
      const profileTiers = events.data
        .filter((event: any) => {
          // Check if this tier belongs to our profile's creator
          return event.parsedJson?.creator === account?.address;
        })
        .map((event: any) => ({
          id: event.parsedJson?.tier_id,
          name: event.parsedJson?.name,
        }));

      setTiers(profileTiers);
      console.log("Found tiers:", profileTiers);
    } catch (error) {
      console.error("Error fetching tiers:", error);
    }
  };

  const handleCreateProfile = async () => {
    if (!account || !handle || !bio) {
      alert("Please fill all fields");
      return;
    }

    setCreatingProfile(true);

    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::creator_profile::create_profile`,
        arguments: [
          tx.pure.string(handle),
          tx.pure.string(bio),
          tx.pure.string("default_profile_image"),
          tx.pure.string("default_banner_image"),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result: any) => {
            console.log("Profile created:", result);
            
            // Wait a bit for the transaction to be indexed
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Re-fetch profile to get the real ID
            await fetchCreatorProfile();
            
            alert("Profile created successfully!");
          },
          onError: (error) => {
            console.error("Profile creation error:", error);
            alert(`Profile creation failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Profile creation error:", error);
      alert(`Profile creation failed: ${error}`);
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleCreateTier = async () => {
    if (!tierName || !tierPrice) {
      alert("Please fill required fields");
      return;
    }

    setCreatingTier(true);

    try {
      const tx = new Transaction();
      
      const priceInMist = BigInt(parseFloat(tierPrice) * 1_000_000_000);
      
      tx.moveCall({
        target: `${PACKAGE_ID}::subscription::create_tier`,
        arguments: [
          tx.object(profileId),
          tx.pure.string(tierName),
          tx.pure.string(tierDescription),
          tx.pure.u64(priceInMist),
          tx.pure.u64(BigInt(maxSubscribers)),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log("Tier created:", result);
            alert("Tier created successfully!");
            
            // Wait and re-fetch tiers
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchTiers(profileId);
            
            // Reset form
            setTierName("");
            setTierDescription("");
            setTierPrice("");
          },
          onError: (error) => {
            console.error("Tier creation error:", error);
            alert(`Tier creation failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Tier creation error:", error);
      alert(`Tier creation failed: ${error}`);
    } finally {
      setCreatingTier(false);
    }
  };

  const handleEditContent = (content: typeof myContent[0]) => {
    setEditingContent(content.content_id);
    setEditTitle(content.title);
    setEditDescription(content.description);
  };

  const handleUpdateContent = async () => {
    if (!editingContent || !editTitle || !editDescription) {
      alert("Please fill in all fields");
      return;
    }

    setIsUpdating(true);
    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::content::update_content`,
        arguments: [
          tx.object(editingContent),
          tx.pure.string(editTitle),
          tx.pure.string(editDescription),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result: any) => {
            console.log("Content updated:", result);
            alert("Content updated successfully! ✅");
            
            // Re-fetch content
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchMyContent();
            
            // Close modal
            setEditingContent(null);
            setEditTitle("");
            setEditDescription("");
          },
          onError: (error) => {
            console.error("Update failed:", error);
            alert(`Update failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Update error:", error);
      alert(`Update failed: ${error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleArchiveContent = async (contentId: string) => {
    if (!confirm("Archive this content? It will be hidden from your profile.")) {
      return;
    }

    setIsUpdating(true);
    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::content::archive_content`,
        arguments: [
          tx.object(contentId),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result: any) => {
            console.log("Content archived:", result);
            alert("Content archived successfully! 📦");
            
            // Re-fetch content
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchMyContent();
          },
          onError: (error) => {
            console.error("Archive failed:", error);
            alert(`Archive failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Archive error:", error);
      alert(`Archive failed: ${error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnarchiveContent = async (contentId: string) => {
    if (!confirm("Restore this content? It will be visible again.")) {
      return;
    }

    setIsUpdating(true);
    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::content::unarchive_content`,
        arguments: [
          tx.object(contentId),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result: any) => {
            console.log("Content restored:", result);
            alert("Content restored successfully! 🔄");
            
            // Re-fetch content
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetchMyContent();
          },
          onError: (error) => {
            console.error("Restore failed:", error);
            alert(`Restore failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Restore error:", error);
      alert(`Restore failed: ${error}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to access the dashboard
          </p>
          <WalletButton />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-2xl font-bold text-blue-600">
                  Web3 Patreon
                </Link>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Creator Dashboard</span>
              </div>
              <WalletButton />
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your profile...</p>
          </div>
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
              <div className="flex items-center gap-4">
                <Link href="/" className="text-2xl font-bold text-blue-600">
                  Web3 Patreon
                </Link>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Creator Dashboard</span>
              </div>
              <WalletButton />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8">
          {!hasProfile ? (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-3xl font-bold mb-6">Create Your Profile</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Handle *
                    </label>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      placeholder="@yourname"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bio *
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      rows={4}
                      placeholder="Tell your fans about yourself..."
                    />
                  </div>

                  <button
                    onClick={handleCreateProfile}
                    disabled={creatingProfile}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {creatingProfile ? "Creating..." : "Create Profile"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stats */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="text-sm text-gray-600 mb-1">Total Subscribers</div>
                  <div className="text-3xl font-bold text-gray-900">0</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="text-sm text-gray-600 mb-1">Monthly Revenue</div>
                  <div className="text-3xl font-bold text-gray-900">0 SUI</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="text-sm text-gray-600 mb-1">Total Content</div>
                  <div className="text-3xl font-bold text-gray-900">{myContent.length}</div>
                </div>
              </div>

              {/* Create Subscription Tier */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Create Subscription Tier</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tier Name *
                    </label>
                    <input
                      type="text"
                      value={tierName}
                      onChange={(e) => setTierName(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      placeholder="e.g., Basic, Premium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price (SUI/month) *
                    </label>
                    <input
                      type="number"
                      value={tierPrice}
                      onChange={(e) => setTierPrice(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      placeholder="5.0"
                      step="0.1"
                      min="0"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={tierDescription}
                      onChange={(e) => setTierDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      rows={2}
                      placeholder="What subscribers get..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Subscribers
                    </label>
                    <input
                      type="number"
                      value={maxSubscribers}
                      onChange={(e) => setMaxSubscribers(e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                      placeholder="100"
                      min="1"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleCreateTier}
                      disabled={creatingTier}
                      className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      {creatingTier ? "Creating..." : "Create Tier"}
                    </button>
                  </div>
                </div>

                {tiers.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600 mb-2">Your Tiers:</p>
                    <div className="flex flex-wrap gap-2">
                      {tiers.map((tier) => (
                        <span
                          key={tier.id}
                          className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                        >
                          {tier.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Content */}
              {tiers.length > 0 && (
                <ContentUploader profileId={profileId} tiers={tiers} />
              )}

              {/* My Content */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">My Content</h3>
                  
                  {/* Tab Switcher */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setShowArchived(false)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        !showArchived 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📁 Active ({myContent.length})
                    </button>
                    <button
                      onClick={() => setShowArchived(true)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        showArchived 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📦 Archived ({archivedContent.length})
                    </button>
                  </div>
                </div>
                
                {/* Active Content */}
                {!showArchived && (
                  <>
                    {myContent.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">
                        No active content. Create some content above! 📝
                      </p>
                    ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myContent.map((content) => (
                      <div
                        key={content.content_id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white"
                      >
                        {/* Thumbnail Preview */}
                        <div className="relative bg-gray-100 overflow-hidden">
                          <ContentViewer
                            content={{
                              id: content.content_id,
                              title: content.title,
                              description: content.description,
                              walrusBlobId: content.walrus_blob_id,
                              sealPolicyId: content.seal_policy_id,
                              isPublic: content.is_public,
                              contentType: content.content_type,
                              creator: account?.address || "",
                            }}
                            hasAccess={true}
                            compact={true}
                          />
                          <div className="absolute top-2 right-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              content.is_public 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {content.is_public ? '🌐' : '🔒'}
                            </span>
                          </div>
                        </div>

                        {/* Content Info */}
                        <div className="p-4">
                          <h4 className="font-semibold text-gray-900 mb-1 truncate">{content.title}</h4>
                          {content.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{content.description}</p>
                          )}
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditContent(content)}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition font-medium"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleArchiveContent(content.content_id)}
                              className="flex-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition font-medium"
                            >
                              📦 Archive
                            </button>
                            <a
                              href={`https://suiscan.xyz/testnet/object/${content.content_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition"
                              title="View on Sui"
                            >
                              🔗
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                    )}
                  </>
                )}

                {/* Archived Content */}
                {showArchived && (
                  <>
                    {archivedContent.length === 0 ? (
                      <p className="text-gray-600 text-center py-8">
                        No archived content. Archive some content to see them here! 📦
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {archivedContent.map((content) => (
                          <div
                            key={content.content_id}
                            className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white opacity-75"
                          >
                            {/* Thumbnail Preview */}
                            <div className="relative bg-gray-100 overflow-hidden">
                              <ContentViewer
                                content={{
                                  id: content.content_id,
                                  title: content.title,
                                  description: content.description,
                                  walrusBlobId: content.walrus_blob_id,
                                  sealPolicyId: content.seal_policy_id,
                                  isPublic: content.is_public,
                                  contentType: content.content_type,
                                  creator: account?.address || "",
                                }}
                                hasAccess={true}
                                compact={true}
                              />
                              <div className="absolute top-2 right-2">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  📦 Archived
                                </span>
                              </div>
                            </div>

                            {/* Content Info */}
                            <div className="p-4">
                              <h4 className="font-semibold text-gray-900 mb-1 truncate">{content.title}</h4>
                              {content.description && (
                                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{content.description}</p>
                              )}
                              
                              {/* Archived Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleUnarchiveContent(content.content_id)}
                                  disabled={isUpdating}
                                  className="flex-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100 transition font-medium disabled:opacity-50"
                                >
                                  🔄 Restore
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm("Permanently delete this content? This cannot be undone!")) {
                                      alert("Permanent delete not implemented yet. Use archive for now.");
                                    }
                                  }}
                                  className="flex-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition font-medium"
                                >
                                  🗑️ Delete
                                </button>
                                <a
                                  href={`https://suiscan.xyz/testnet/object/${content.content_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition"
                                  title="View on Sui"
                                >
                                  🔗
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingContent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Content</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                    placeholder="Content title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 resize-none"
                    placeholder="Content description"
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditingContent(null);
                    setEditTitle("");
                    setEditDescription("");
                  }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateContent}
                  disabled={isUpdating || !editTitle || !editDescription}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                >
                  {isUpdating ? "Updating..." : "Update"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

