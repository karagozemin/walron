"use client";

import Link from "next/link";
import { WalletButton } from "@/components/auth/WalletButton";

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              Web3 Patreon
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/explore"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Explore
              </Link>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Coming Soon Badge */}
          <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            Coming Soon
          </div>

          {/* Title */}
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            NFT Marketplace
          </h1>

          {/* Description */}
          <p className="text-xl text-gray-600 mb-12">
            Trade and sell your subscription NFTs. This feature is currently under development.
          </p>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-4xl mb-4">🎫</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Transfer NFTs
              </h3>
              <p className="text-gray-600 text-sm">
                Gift or transfer your subscription NFTs to other users
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Secondary Market
              </h3>
              <p className="text-gray-600 text-sm">
                Buy and sell subscription NFTs on the open market
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Price Discovery
              </h3>
              <p className="text-gray-600 text-sm">
                View market prices and trending subscriptions
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="space-x-4">
            <Link
              href="/explore"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Explore Creators
            </Link>
            <Link
              href="/dashboard"
              className="inline-block bg-gray-200 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
