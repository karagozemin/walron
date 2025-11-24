"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { WalletButton } from "@/components/auth/WalletButton";
import { ContentUploader } from "@/components/creator/ContentUploader";
import { ContentViewer } from "@/components/content/ContentViewer";
import { LoadingWalrus } from "@/components/LoadingWalrus";
import { PACKAGE_ID } from "@/lib/sui/config";
import { suiClient } from "@/lib/sui/client";
import { getUserSuiNS } from "@/lib/suins/client";
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
    encryption_key: string;
    required_tier_id: string;
  }>>([]);
  
  // Form states
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [userSuiNS, setUserSuiNS] = useState<string | null>(null);
  const [checkingSuiNS, setCheckingSuiNS] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [tierName, setTierName] = useState("");
  const [tierDescription, setTierDescription] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [maxSubscribers, setMaxSubscribers] = useState("100");
  
  // Edit/Delete modal states
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Analytics states
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalSubscribers, setTotalSubscribers] = useState<number>(0);
  
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
    encryption_key: string;
    required_tier_id: string;
  }>>([]);
  
  // Profile editing states
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editHandle, setEditHandle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editProfileImage, setEditProfileImage] = useState<File | null>(null);
  const [editBannerImage, setEditBannerImage] = useState<File | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Auto-fetch creator profile on mount
  useEffect(() => {
    if (account?.address) {
      fetchCreatorProfile();
      checkUserSuiNS();
    }
  }, [account?.address]);

  // Check if user has a SuiNS name
  const checkUserSuiNS = async () => {
    if (!account?.address) return;
    
    setCheckingSuiNS(true);
    try {
      const suinsName = await getUserSuiNS(account.address, suiClient);
      setUserSuiNS(suinsName);
      if (suinsName) {
        console.log('✅ User has SuiNS:', suinsName);
        // Auto-fill handle from SuiNS (remove .sui suffix)
        const handleFromSuins = suinsName.replace('.sui', '');
        if (!handle || handle === '') {
          setHandle(handleFromSuins);
          // Check if this handle is available
          checkHandleAvailability(handleFromSuins);
        }
      }
    } catch (error) {
      console.error('Error checking SuiNS:', error);
    } finally {
      setCheckingSuiNS(false);
    }
  };

  // Check if handle is available
  const checkHandleAvailability = async (handleToCheck: string) => {
    if (!handleToCheck || handleToCheck.trim() === '') {
      setHandleAvailable(null);
      return;
    }

    setCheckingHandle(true);
    try {
      const profileEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
        },
        limit: 100,
      });

      const handleTaken = profileEvents.data.some(
        (event: any) => event.parsedJson?.handle === handleToCheck
      );

      setHandleAvailable(!handleTaken);
    } catch (error) {
      console.error('Error checking handle:', error);
      setHandleAvailable(null);
    } finally {
      setCheckingHandle(false);
    }
  };

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
        
        // Fetch full profile object to get handle, bio, images, etc.
        const profileObj = await suiClient.getObject({
          id: profileIdFromEvent,
          options: { showContent: true },
        });

        if (profileObj.data?.content?.dataType === "moveObject") {
          const fields = profileObj.data.content.fields as any;
          setHandle(fields.handle || "");
          setBio(fields.bio || "");
          console.log("✅ Profile loaded:", {
            handle: fields.handle,
            bio: fields.bio,
            profileImage: fields.profile_image_blob_id,
            bannerImage: fields.banner_image_blob_id,
            suinsName: fields.suins_name
          });
        }
        
        setHasProfile(true);
        
        // Fetch existing tiers for this profile
        await fetchTiers(profileIdFromEvent);
        // Fetch user's content
        await fetchMyContent();
        // Fetch analytics
        await fetchAnalytics(profileIdFromEvent);
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
              encryption_key: fields.encryption_key || "",
              required_tier_id: fields.required_tier_id || "",
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
              encryption_key: "",
              required_tier_id: "",
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

  const uploadImageToWalrus = async (file: File): Promise<string> => {
    try {
      console.log("📤 Uploading to Walrus:", file.name, `(${(file.size / 1024).toFixed(2)} KB)`);
      
      // Use the CORRECT Walrus publisher endpoint with epochs parameter
      const publisherUrl = "https://publisher.walrus-testnet.walrus.space";
      const numEpochs = 1;
      const walrusUrl = `${publisherUrl}/v1/blobs?epochs=${numEpochs}`;
      console.log("🌐 Walrus URL:", walrusUrl);
      
      const response = await fetch(walrusUrl, {
        method: "PUT",
        body: file,
      });

      console.log("📥 Walrus response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Walrus upload failed:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Walrus upload failed (${response.status}): ${errorText || response.statusText}`);
      }

      const responseText = await response.text();
      console.log("📄 Walrus raw response:", responseText.substring(0, 200));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("❌ Failed to parse JSON:", parseError);
        console.error("Response was:", responseText);
        throw new Error("Invalid JSON response from Walrus");
      }
      
      console.log("📦 Parsed Walrus data:", data);
      
      // Response format: { newlyCreated: { blobObject: { blobId, ... } } }
      // or { alreadyCertified: { blobId, ... } }
      if (data.newlyCreated) {
        const blobId = data.newlyCreated.blobObject.blobId;
        console.log("✅ New blob created:", blobId);
        return blobId;
      } else if (data.alreadyCertified) {
        const blobId = data.alreadyCertified.blobId;
        console.log("✅ Blob already exists:", blobId);
        return blobId;
      }
      
      console.error("❌ Unexpected response structure:", data);
      throw new Error("Unexpected Walrus response format");
    } catch (error) {
      console.error("❌ Image upload error:", error);
      throw error;
    }
  };

  const handleUpdateProfile = async () => {
    if (!profileId || !editBio) {
      alert("Please fill all required fields");
      return;
    }

    if (!account?.address) {
      alert("Please connect your wallet");
      return;
    }

    setUpdatingProfile(true);

    try {
      // Find CreatorCap owned by user
      console.log("🔍 Looking for CreatorCap...");
      const ownedObjects = await suiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          StructType: `${PACKAGE_ID}::creator_profile::CreatorCap`,
        },
        options: {
          showContent: true,
        },
      });

      if (ownedObjects.data.length === 0) {
        alert("CreatorCap not found. You need to own the profile to edit it.");
        setUpdatingProfile(false);
        return;
      }

      const creatorCapId = ownedObjects.data[0].data?.objectId;
      console.log("✅ Found CreatorCap:", creatorCapId);

      // Upload new images if provided
      let profileImageBlobId = "";
      let bannerImageBlobId = "";

      if (editProfileImage) {
        console.log("Uploading new profile image...");
        profileImageBlobId = await uploadImageToWalrus(editProfileImage);
        console.log("Profile image uploaded:", profileImageBlobId);
      }

      if (editBannerImage) {
        console.log("Uploading new banner image...");
        bannerImageBlobId = await uploadImageToWalrus(editBannerImage);
        console.log("Banner image uploaded:", bannerImageBlobId);
      }

      const tx = new Transaction();
      
      // Contract signature: update_profile(profile, cap, bio, profile_image, banner_image, suins_name, ctx)
      tx.moveCall({
        target: `${PACKAGE_ID}::creator_profile::update_profile`,
        arguments: [
          tx.object(profileId), // profile
          tx.object(creatorCapId!), // cap
          tx.pure.string(editBio), // bio
          tx.pure.string(profileImageBlobId || ""), // profile_image_blob_id
          tx.pure.string(bannerImageBlobId || ""), // banner_image_blob_id
          tx.pure.string(userSuiNS || ""), // suins_name
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result: any) => {
            console.log("Profile updated:", result);
            alert("Profile updated successfully!");
            setShowEditProfile(false);
            
            // Re-fetch profile
            await fetchCreatorProfile();
          },
          onError: (error) => {
            console.error("Profile update error:", error);
            alert(`Profile update failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Profile update error:", error);
      alert(`Profile update failed: ${error}`);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!account || !handle || !bio) {
      alert("Please fill all fields");
      return;
    }

    setCreatingProfile(true);

    try {
      // Check if handle is already taken
      console.log("🔍 Checking if handle is available:", handle);
      const profileEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::creator_profile::ProfileCreated`,
        },
        limit: 100,
      });

      const handleTaken = profileEvents.data.some(
        (event: any) => event.parsedJson?.handle === handle
      );

      if (handleTaken) {
        alert(`Handle "@${handle}" is already taken. Please choose a different one.`);
        setCreatingProfile(false);
        return;
      }

      console.log("✅ Handle is available!");
      setUploadingImages(true);

      // Upload images to Walrus if provided
      let profileImageBlobId = "";
      let bannerImageBlobId = "";

      if (profileImage) {
        console.log("Uploading profile image to Walrus...");
        profileImageBlobId = await uploadImageToWalrus(profileImage);
        console.log("Profile image uploaded:", profileImageBlobId);
      }

      if (bannerImage) {
        console.log("Uploading banner image to Walrus...");
        bannerImageBlobId = await uploadImageToWalrus(bannerImage);
        console.log("Banner image uploaded:", bannerImageBlobId);
      }

      setUploadingImages(false);

      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PACKAGE_ID}::creator_profile::create_profile`,
        arguments: [
          tx.pure.string(handle),
          tx.pure.string(bio),
          tx.pure.string(profileImageBlobId || ""),
          tx.pure.string(bannerImageBlobId || ""),
          tx.pure.string(userSuiNS || ""), // SuiNS name or empty string
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
      setUploadingImages(false);
    }
  };

  const fetchAnalytics = async (profileIdToQuery: string) => {
    if (!account?.address) return;
    
    try {
      // 1. Fetch wallet balance (SUI coins)
      const balance = await suiClient.getBalance({
        owner: account.address,
        coinType: '0x2::sui::SUI'
      });
      const balanceInSUI = parseInt(balance.totalBalance) / 1_000_000_000;
      setWalletBalance(balanceInSUI);
      
      // 2. Fetch profile object for total_revenue and total_subscribers
      const profileObj = await suiClient.getObject({
        id: profileIdToQuery,
        options: { showContent: true }
      });
      
      if (profileObj.data?.content?.dataType === 'moveObject') {
        const fields = profileObj.data.content.fields as any;
        const revenueInMIST = parseInt(fields.total_revenue || '0');
        const revenueInSUI = revenueInMIST / 1_000_000_000;
        setTotalRevenue(revenueInSUI);
        setTotalSubscribers(parseInt(fields.total_subscribers || '0'));
        
        console.log('📊 Analytics fetched:', {
          walletBalance: balanceInSUI,
          totalRevenue: revenueInSUI,
          totalSubscribers: fields.total_subscribers
        });
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
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
    return <LoadingWalrus />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-2xl font-bold text-blue-600">
                  <span>🦭</span> Walron
                </Link>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Creator Dashboard</span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/explore" className="text-gray-600 hover:text-gray-900 font-medium">
                  Explore
                </Link>
                <Link href="/marketplace" className="text-gray-600 hover:text-gray-900 font-medium">
                  Marketplace
                </Link>
                <WalletButton />
              </div>
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
                      {userSuiNS && (
                        <span className="ml-2 text-xs text-green-600 font-normal">
                          (Auto-filled from SuiNS)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                    <input
                      type="text"
                      value={handle}
                        onChange={(e) => {
                          const newHandle = e.target.value;
                          setHandle(newHandle);
                          // Debounced check
                          if (newHandle.trim()) {
                            setTimeout(() => checkHandleAvailability(newHandle), 500);
                          } else {
                            setHandleAvailable(null);
                          }
                        }}
                        disabled={!!userSuiNS}
                        className={`w-full border rounded p-2 text-gray-900 bg-white focus:ring-2 outline-none pr-10 ${
                          userSuiNS 
                            ? 'bg-gray-50 cursor-not-allowed opacity-75 border-gray-300' 
                            : handleAvailable === true
                            ? 'border-green-500 focus:border-green-500 focus:ring-green-200'
                            : handleAvailable === false
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                        }`}
                        placeholder={userSuiNS ? userSuiNS.replace('.sui', '') : "@yourname"}
                      />
                      {!userSuiNS && handle && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingHandle ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                          ) : handleAvailable === true ? (
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : handleAvailable === false ? (
                            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {userSuiNS ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Handle is automatically set from your SuiNS name. To use a different handle, disconnect your SuiNS name first.
                      </p>
                    ) : handleAvailable === false ? (
                      <p className="text-xs text-red-600 mt-1">
                        ❌ Handle "@{handle}" is already taken. Please choose a different one.
                      </p>
                    ) : handleAvailable === true ? (
                      <p className="text-xs text-green-600 mt-1">
                        ✅ Handle "@{handle}" is available!
                      </p>
                    ) : null}
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

                  {/* Profile Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Image
                    </label>
                    <div className="flex items-center gap-4">
                      {profileImage && (
                        <img
                          src={URL.createObjectURL(profileImage)}
                          alt="Profile preview"
                          className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProfileImage(e.target.files?.[0] || null)}
                        className="flex-1 border border-gray-300 rounded p-2 text-gray-900 bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: Square image, at least 400x400px
                    </p>
                  </div>

                  {/* Banner Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Banner Image
                    </label>
                    <div className="space-y-2">
                      {bannerImage && (
                        <img
                          src={URL.createObjectURL(bannerImage)}
                          alt="Banner preview"
                          className="w-full h-32 rounded-lg object-cover border-2 border-gray-200"
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBannerImage(e.target.files?.[0] || null)}
                        className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: Wide image, at least 1200x300px
                    </p>
                  </div>

                  {/* SuiNS Display */}
                  {checkingSuiNS ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-700">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        <span className="text-sm">Checking for SuiNS name...</span>
                      </div>
                    </div>
                  ) : userSuiNS ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-green-800">SuiNS Name Detected!</span>
                      </div>
                      <p className="text-sm text-green-700">
                        Your profile will be accessible via: <span className="font-mono font-bold">{userSuiNS}</span>
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        This will be saved to your creator profile automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">No SuiNS Name</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        You can register a .sui name at{' '}
                        <a href="https://testnet.suins.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          suins.io
                        </a>
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleCreateProfile}
                    disabled={
                      creatingProfile || 
                      uploadingImages || 
                      checkingHandle || 
                      handleAvailable === false || 
                      (!userSuiNS && !handle)
                    }
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {uploadingImages
                      ? "Uploading images..."
                      : creatingProfile
                      ? "Creating profile..."
                      : checkingHandle
                      ? "Checking handle..."
                      : handleAvailable === false
                      ? "Handle already taken"
                      : "Create Profile"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Profile Info & Actions */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900">@{handle}</h2>
                    <p className="text-gray-600 mt-1">{bio}</p>
                    {userSuiNS && (
                      <div className="flex items-center gap-2 mt-2">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-green-600 font-medium">{userSuiNS}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/creator/${userSuiNS || handle || account?.address}`}
                      target="_blank"
                      className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 transition flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View Public Profile
                    </Link>
                    <button
                    onClick={() => {
                      setEditBio(bio);
                      setShowEditProfile(true);
                    }}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Profile
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm opacity-90">Wallet Balance</div>
                    <svg className="w-8 h-8 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div className="text-3xl font-bold">{walletBalance.toFixed(2)} SUI</div>
                  <div className="text-xs opacity-75 mt-1">Available to use</div>
                </div>
                
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm opacity-90">Total Revenue</div>
                    <svg className="w-8 h-8 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-3xl font-bold">{totalRevenue.toFixed(2)} SUI</div>
                  <div className="text-xs opacity-75 mt-1">All-time earnings</div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm opacity-90">Subscribers</div>
                    <svg className="w-8 h-8 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-3xl font-bold">{totalSubscribers}</div>
                  <div className="text-xs opacity-75 mt-1">Active members</div>
                </div>
                
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm opacity-90">Total Content</div>
                    <svg className="w-8 h-8 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="text-3xl font-bold">{myContent.length}</div>
                  <div className="text-xs opacity-75 mt-1">Published items</div>
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
                <ContentUploader 
                  profileId={profileId} 
                  tiers={tiers} 
                  onSuccess={fetchMyContent} 
                />
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
                              encryptionKey: content.encryption_key,
                              requiredTierId: content.required_tier_id,
                            }}
                            hasAccess={true}
                            compact={true}
                          />
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              content.is_public 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {content.is_public ? '🌐' : '🔒'}
                            </span>
                            {!content.is_public && !content.encryption_key && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ⚠️ Key Missing
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Content Info */}
                        <div className="p-4">
                          <h4 className="font-semibold text-gray-900 mb-1 truncate">{content.title}</h4>
                          {content.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">{content.description}</p>
                          )}
                          
                          {/* Warning for missing encryption key */}
                          {!content.is_public && !content.encryption_key && (
                            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                              ⚠️ Encryption key missing. Re-upload recommended.
                            </div>
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
                                  encryptionKey: content.encryption_key,
                                  requiredTierId: content.required_tier_id,
                                }}
                                hasAccess={true}
                                compact={true}
                              />
                              <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  📦 Archived
                                </span>
                                {!content.is_public && !content.encryption_key && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    ⚠️ Key Missing
                                  </span>
                                )}
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

        {/* Edit Profile Modal */}
        {showEditProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full p-8 my-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h3>
              
              <div className="space-y-6">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> Handle cannot be changed after profile creation. 
                    Only bio and images can be updated.
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    Current Handle: <span className="font-semibold">@{handle}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 resize-none"
                    placeholder="Tell your fans about yourself..."
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Profile Image
                  </label>
                  <div className="flex items-center gap-4">
                    {editProfileImage && (
                      <img
                        src={URL.createObjectURL(editProfileImage)}
                        alt="Profile preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditProfileImage(e.target.files?.[0] || null)}
                      className="flex-1 border border-gray-300 rounded p-2 text-gray-900 bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to keep current image
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Banner Image
                  </label>
                  <div className="space-y-2">
                    {editBannerImage && (
                      <img
                        src={URL.createObjectURL(editBannerImage)}
                        alt="Banner preview"
                        className="w-full h-32 rounded-lg object-cover border-2 border-gray-200"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditBannerImage(e.target.files?.[0] || null)}
                      className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to keep current image
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setShowEditProfile(false);
                    setEditBio("");
                    setEditProfileImage(null);
                    setEditBannerImage(null);
                  }}
                  disabled={updatingProfile}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProfile}
                  disabled={updatingProfile || !editBio}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
                >
                  {updatingProfile ? "Updating..." : "Update Profile"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

