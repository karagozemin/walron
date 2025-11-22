"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { walrusService } from "@/lib/walrus/client";
import { sealService } from "@/lib/seal/encryption";
import { getRealSealService } from "@/lib/seal/real-seal";
import { PACKAGE_ID } from "@/lib/sui/config";
import { suiClient } from "@/lib/sui/client";

interface ContentUploaderProps {
  profileId: string;
  tiers: Array<{ id: string; name: string }>;
}

export function ContentUploader({ profileId, tiers }: ContentUploaderProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isPPV, setIsPPV] = useState(false);
  const [ppvPrice, setPpvPrice] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !account || !title) {
      alert("Please fill all required fields");
      return;
    }

    setUploading(true);
    
    try {
      // Step 1: Read file
      setProgress("Reading file...");
      const fileBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(fileBuffer);

      // Step 2: Encrypt with Seal (if not public)
      let encryptedDataWithIV: Uint8Array = fileData;
      let policyId = "public";
      let ivForKey: Uint8Array | null = null;
      let exportedKey: Uint8Array | null = null;

      if (!isPublic) {
        setProgress("Encrypting with Seal SDK...");
        
        try {
          // Use REAL Seal SDK for encryption
          const realSeal = getRealSealService(suiClient);
          
          // Identity is the tier ID (content is encrypted for specific tier subscribers)
          const identity = selectedTier || `content_${Date.now()}`;
          
          const result = await realSeal.encryptContent(
            fileData,
            PACKAGE_ID, // Package ID as namespace
            identity     // Tier ID as identity
          );
          
          // Store encrypted object and symmetric key
          encryptedDataWithIV = result.encryptedObject;
          exportedKey = result.symmetricKey;
          policyId = `seal_${result.id}`;
          
          console.log("✅ Real Seal encryption complete:", {
            encryptedSize: encryptedDataWithIV.length,
            keySize: exportedKey.length,
            identity: result.id,
          });
          
        } catch (error) {
          console.error("Real Seal encryption failed, falling back to mock:", error);
          
          // Fallback to mock implementation if real Seal fails
          const policy = isPPV
            ? sealService.createPurchasePolicy(account.address, "temp_content_id")
            : sealService.createSubscriptionPolicy(account.address, selectedTier);

          const mockResult = await sealService.encryptContent(fileData, policy);
          const encryptedData = new Uint8Array(mockResult.encryptedData);
          const iv = new Uint8Array(mockResult.iv);
          policyId = mockResult.policyId;
          ivForKey = iv;
          exportedKey = mockResult.exportedKey || null;
          
          encryptedDataWithIV = new Uint8Array(iv.length + encryptedData.length);
          encryptedDataWithIV.set(iv, 0);
          encryptedDataWithIV.set(encryptedData, iv.length);
        }
      }

      // Step 3: Upload to Walrus
      setProgress("Uploading to Walrus...");
      const blob = new Blob([new Uint8Array(encryptedDataWithIV)]);
      const uploadFile = new File([blob], file.name);
      const { blobId } = await walrusService.uploadFile(uploadFile);

      // Step 5: Create on-chain record
      setProgress("Creating on-chain record...");
      const tx = new Transaction();
      
      const clockObjectId = "0x6"; // Sui Clock object
      
      // Convert encryption key to base64 for storage (IV + policyId + raw key bytes)
      let keyBase64 = "";
      if (!isPublic && exportedKey && ivForKey) {
        const keyString = Array.from(ivForKey).join(",") + ":" + 
                         policyId + ":" + 
                         Array.from(exportedKey).join(",");
        keyBase64 = btoa(keyString);
        console.log("Storing key to blockchain:", {
          ivLength: ivForKey.length,
          keyLength: exportedKey.length,
          policyId,
          encodedLength: keyBase64.length,
          preview: keyString.substring(0, 100)
        });
      }
      
      tx.moveCall({
        target: `${PACKAGE_ID}::content::create_content`,
        arguments: [
          tx.object(profileId),
          tx.pure.string(title),
          tx.pure.string(description),
          tx.pure.string(blobId),
          tx.pure.string(policyId),
          tx.pure.id(selectedTier || "0x0"),
          tx.pure.bool(isPublic),
          tx.pure.bool(isPPV),
          tx.pure.u64(isPPV ? BigInt(ppvPrice) * BigInt(1_000_000_000) : 0),
          tx.pure.string(file.type.split("/")[0] || "file"),
          tx.pure.string(keyBase64), // Store encryption key on-chain
          tx.object(clockObjectId),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            console.log("Content created:", result);
            setProgress("Upload complete!");
            alert("Content uploaded successfully!");
            
            // Reset form
            setFile(null);
            setTitle("");
            setDescription("");
            setSelectedTier("");
            setIsPublic(false);
            setIsPPV(false);
            setPpvPrice("");
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            alert(`Upload failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Upload error:", error);
      alert(`Upload failed: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Content</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            accept="image/*,video/*,audio/*,.pdf"
          />
          {file && (
            <p className="text-sm text-gray-600 mt-1">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            placeholder="Content title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            rows={3}
            placeholder="Content description"
          />
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Public (no encryption)</span>
          </label>
        </div>

        {!isPublic && (
          <>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isPPV}
                  onChange={(e) => setIsPPV(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Pay-Per-View</span>
              </label>
            </div>

            {isPPV ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (SUI)</label>
                <input
                  type="number"
                  value={ppvPrice}
                  onChange={(e) => setPpvPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  placeholder="0.5"
                  step="0.1"
                  min="0"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Required Tier</label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full border border-gray-300 rounded p-2 text-gray-900 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                >
                  <option value="">Select tier</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {uploading && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <span className="text-sm text-blue-800">{progress}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !file || !title}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {uploading ? "Uploading..." : "Upload Content"}
        </button>
      </div>
    </div>
  );
}

