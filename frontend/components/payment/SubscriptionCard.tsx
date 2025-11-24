"use client";

import { useState } from "react";
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID } from "@/lib/sui/config";
import { suiClient } from "@/lib/sui/client";

interface SubscriptionCardProps {
  tier: {
    id: string;
    name: string;
    description: string;
    pricePerMonth: string;
    currentSubscribers: number;
    maxSubscribers: number;
  };
  profileId: string;
  isSubscribed?: boolean;
}

export function SubscriptionCard({ tier, profileId, isSubscribed }: SubscriptionCardProps) {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async () => {
    setSubscribing(true);

    try {
      const tx = new Transaction();
      
      // Calculate price in MIST (1 SUI = 1,000,000,000 MIST)
      const priceInMist = BigInt(parseFloat(tier.pricePerMonth) * 1_000_000_000);
      
      // Split coins for payment
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(priceInMist)]);
      
      const clockObjectId = "0x6"; // Sui Clock object
      
      // Generate encryption key for subscriber
      const subscriberKey = btoa("subscriber_key_" + tier.id + "_" + Date.now());
      
      tx.moveCall({
        target: `${PACKAGE_ID}::subscription::subscribe`,
        arguments: [
          tx.object(tier.id),
          tx.object(profileId),
          coin,
          tx.pure.string(subscriberKey), // Pass encryption key
          tx.object(clockObjectId),
        ],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            console.log("✅ Subscription transaction submitted:", result.digest);
            
            try {
              // Wait for transaction to be finalized on blockchain
              console.log("⏳ Waiting for blockchain confirmation...");
              const txResult = await suiClient.waitForTransaction({
                digest: result.digest,
                options: { showEffects: true, showObjectChanges: true }
              });
              
              console.log("✅ Transaction confirmed on blockchain!");
              console.log("📦 Transaction result:", txResult);
              
              // Find the created Subscription NFT in object changes
              const objectChanges = txResult.objectChanges || [];
              const subscriptionNFT = objectChanges.find(
                (change: any) => 
                  change.type === 'created' && 
                  change.objectType?.includes('::subscription::Subscription')
              );
              
              if (subscriptionNFT) {
                console.log("🎟️ Subscription NFT created:", subscriptionNFT);
              }
              
              // Additional delay to ensure indexing (5 seconds for better reliability)
              console.log("⏳ Waiting for indexing (5 seconds)...");
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              console.log("✅ Reloading page to show new subscription...");
              alert("Successfully subscribed! Content will unlock now.");
              window.location.reload();
            } catch (waitError) {
              console.error("❌ Error waiting for transaction:", waitError);
              alert("Subscribed, but please refresh manually to see changes.");
              // Still reload after 3 seconds even if wait fails
              setTimeout(() => window.location.reload(), 3000);
            }
          },
          onError: (error) => {
            console.error("❌ Subscription transaction error:", error);
            alert(`Subscription failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Subscribe error:", error);
      alert(`Subscription failed: ${error}`);
    } finally {
      setSubscribing(false);
    }
  };

  const isFull = tier.currentSubscribers >= tier.maxSubscribers;

  // Define benefits based on tier price
  const benefits = [
    "Access to all exclusive content",
    "Early access to new posts",
    "Direct support to the creator",
    "Cancel anytime",
  ];

  // Add more benefits for higher tiers
  if (parseFloat(tier.pricePerMonth) >= 0.5) {
    benefits.push("Priority comments");
    benefits.push("Behind-the-scenes content");
  }

  if (parseFloat(tier.pricePerMonth) >= 1) {
    benefits.push("Monthly Q&A sessions");
    benefits.push("Exclusive community access");
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white text-center">
        <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-bold">
            {tier.pricePerMonth}
          </span>
          <span className="text-blue-100">SUI/month</span>
        </div>
      </div>

      <div className="p-6">
        <p className="text-gray-600 mb-6">{tier.description}</p>

        {/* Benefits */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
            What you get:
          </h4>
          <ul className="space-y-3">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span className="font-medium">Subscribers</span>
            <span className="font-semibold">
              {tier.currentSubscribers} / {tier.maxSubscribers}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all"
              style={{
                width: `${Math.min((tier.currentSubscribers / tier.maxSubscribers) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Subscribe Button */}
        {isSubscribed ? (
          <div className="bg-green-50 border-2 border-green-500 text-green-700 py-3 px-4 rounded-lg text-center font-semibold flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Subscribed
          </div>
        ) : (
          <button
            onClick={handleSubscribe}
            disabled={subscribing || isFull}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl"
          >
            {subscribing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Subscribing...
              </span>
            ) : isFull ? (
              "Tier Full"
            ) : (
              `Join for ${tier.pricePerMonth} SUI/mo`
            )}
          </button>
        )}

        {isFull && !isSubscribed && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm text-center font-medium">
            ⚠️ This tier is currently full
          </div>
        )}
      </div>
    </div>
  );
}

