<div align="center">
  <img src="frontend/public/walron.JPG" alt="Walron Logo" width="205"/>
  
  # Walron
  
  **Web3 Patreon (Seal + Walrus)**
  
  Built for the Walrus Haulout Hackathon 2025
</div>

Web3 Patreon built with Seal encryption and Walrus storage on the Sui blockchain. Creators own their content, fans get verifiable access, and everything runs on-chain.

## 🌟 Overview

Creators today face high platform fees, restrictive monetization models, and a lack of direct ownership over their audience relationships. Fans have little transparency into how their money supports creators, and valuable content remains locked within centralized systems.

**Walron** is a Web3 Patreon (Seal + Walrus) that empowers creators to own their identity, content, and monetization rules—while giving fans transparent, verifiable access to exclusive material.

The platform enables:
- **Direct creator–fan relationships** without intermediaries
- **Programmable monetization models** adaptable to any content format
- **Encrypted, verifiable content access** based on clear, onchain rules
- **Privacy-first architecture** that protects both creator and fan data
- **Global, censorship-resistant infrastructure** to ensure long-term access

The name **Walron** combines **Walrus** (decentralized storage) + **Patreon** (creator platform), representing our mission to build the future of creator economy on the Sui Stack.

## ✨ Deliverables (All Fully Implemented)

### 1️⃣ Creator Profiles
✅ **Public-facing creator pages** with profile information, content previews, and subscription tiers
- Complete profile system with custom handles, bios, profile/banner images
- Real-time analytics dashboard (wallet balance, revenue, subscribers, content count)
- Full profile editing with image uploads via Walrus

✅ **Portable identity** that persists beyond the platform
- SuiNS integration: Human-readable `.sui` domains for creator profiles
- On-chain identity that works across any compatible Sui app
- Profile pages accessible via SuiNS name, handle, or wallet address

### 2️⃣ Secure Content Hosting & Delivery
✅ **Encrypted storage** of media, text posts, and downloadable files
- Real @mysten/seal SDK with Identity-Based Encryption (IBE)
- All content stored on Walrus (decentralized, censorship-resistant)
- Profile images and banners also on Walrus

✅ **Tier-based access controls**
- Fine-grained access control per subscription tier
- Each tier has unique encryption keys
- On-chain verification before content decryption

### 3️⃣ Authentication & Access Management
✅ **Secure sign-in experience** for fans and creators
- Wallet-based authentication (@mysten/dapp-kit)
- SuiNS name display for verified identities
- Seamless transaction signing

✅ **Fine-grained access control** for different content tiers
- Subscription NFTs prove membership on-chain
- Access checks happen on-chain (trustless)
- SessionKey authorization for decryption

### 4️⃣ Monetization & Payments
✅ **Monthly subscriptions**
- Unlimited subscription tiers with custom pricing
- Subscription NFTs (tradeable, transferable with `has key, store`)
- Automatic revenue tracking on-chain

✅ **Tipping**
- Instant SUI tips with optional messages
- Direct creator-to-fan payments

✅ **Transparent, programmable revenue sharing**
- 100% of fees go directly to creators (no intermediaries)
- All transactions visible on-chain
- No hidden fees

### 5️⃣ Content Portability & Composability
✅ **Creators and fans can take content and access rights across compatible platforms**
- Subscription NFTs with `has key, store` (fully transferable)
- Access logic works with any app that supports Sui standards
- On-chain access policies readable by any platform

✅ **Enables:**
- **NFT marketplaces for premium content**: Subscription NFTs can be sold/transferred
- **Token-gated platforms**: Use subscription tokens as access keys
- **Cross-platform access**: Same subscription works anywhere
- **Social integrations**: Verify subscription status for Discord/Telegram bots

## 🏗️ Architecture

### Technical Integration with the Sui Stack

**Sui** - Hosts all programmable logic
- Smart contracts for subscriptions, payments, and access tiers (Move language)
- Maintains transparent, auditable records of fan–creator interactions
- Subscription NFTs with full transferability (`has key, store`)

**Seal** - Encrypts all private creator content
- Real @mysten/seal SDK with Identity-Based Encryption (IBE)
- Enforces tiered and conditional access policies entirely onchain
- Threshold cryptography (1-of-2 key servers) for decentralized key management

**Walrus** - Stores all large media files and archives
- Decentralized, verifiable storage for all content
- Profile images, banners, and content blobs
- Works with Seal to ensure only authorized fans can decrypt and view content

**SuiNS** - Provides human-readable creator handles
- Portable identity (e.g., `creatorname.sui`)
- Automatic detection and display of `.sui` names
- Profile URLs work with SuiNS, handle, or address

**Additional Tech:**
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Wallet**: @mysten/dapp-kit for seamless authentication
- **Caching**: IndexedDB for performance optimization

### Smart Contracts

Four core Move modules power the platform:

1. **creator_profile.move** - Profile management and creator identity
2. **subscription.move** - Subscription tiers and membership NFTs  
3. **content.move** - Content posts and access control
4. **payment.move** - Tipping and revenue tracking

### Data Flow

```
Creator uploads content
    ↓
1. Content encrypted with Seal (access policy created)
    ↓
2. Encrypted data uploaded to Walrus (blob ID returned)
    ↓
3. On-chain record created (blob ID + policy ID stored)
    ↓
Fan subscribes
    ↓
4. Subscription NFT minted and transferred to fan
    ↓
5. Fan can now decrypt and view content
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Sui CLI
- A Sui wallet (Sui Wallet, Suiet, etc.)
- (Optional) SuiNS domain for human-readable profile URLs

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd wal

# Install frontend dependencies
cd frontend
npm install

# Build Move contracts (already deployed)
cd ../contracts
sui move build
```

### Environment Variables

Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_PACKAGE_ID=0xdbd66ba1348f60cdac421c2da4a09d2f56a48fa64963307b3842896258723e35
```

### Running Locally

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💾 **IndexedDB Content Cache**

### **What is it?**
To avoid re-decryption and re-signing on every page refresh, decrypted content is automatically cached in the browser's **IndexedDB** (local storage).

### **Benefits:**
- ⚡ **Instant Load**: Second time viewing content = 0.1 seconds (vs 5-8 seconds)
- 🔑 **No Re-sign**: SessionKey is reused from localStorage
- 🔓 **No Re-decrypt**: Decrypted content loaded from IndexedDB
- 🌐 **No Blockchain Call**: Zero Seal SDK overhead after first load

### **Cache Behavior:**
- **Max Size**: 20MB per content (larger files are not cached)
- **Duration**: 8 hours (automatically cleaned up)
- **Storage**: Browser's IndexedDB (separate from localStorage)
- **Security**: Cleared on logout, subscription cancel, or expiry

### **How to Monitor:**
Add the `<CacheStats />` component to any page to see cache statistics:

```typescript
import { CacheStats } from "@/components/cache/CacheStats";

// In your page component:
<CacheStats />
```

### **Cache Locations:**
- `frontend/lib/cache/indexed-db-cache.ts` - Core implementation
- `frontend/components/content/ContentViewer.tsx` - Integrated (read/write)
- `frontend/components/auth/WalletButton.tsx` - Clear on logout
- `frontend/components/cache/CacheStats.tsx` - Stats component (optional)

---

## 📝 Usage Guide

### For Creators

1. **Connect Wallet** - Click "Connect Wallet" in the header (SuiNS name displayed if available)
2. **Create Profile** - Go to Dashboard and create your creator profile
   - Choose a unique handle (real-time availability checking)
   - Upload profile and banner images
   - Add bio and description
   - SuiNS name auto-detected if you own one
3. **Set Up Tiers** - Create subscription tiers with custom pricing
4. **Upload Content** - Upload encrypted content for your subscribers (max 5MB per file)
   - Content automatically encrypted with Seal
   - Stored on Walrus for decentralization
   - Assign to specific tiers for access control
5. **Manage Profile** - Edit profile, view analytics, track revenue
6. **Share Profile** - Share via `yourname.sui`, `yourhandle`, or wallet address

### For Fans

1. **Connect Wallet** - Connect your Sui wallet
2. **Explore Creators** - Browse creators on the Explore page
3. **Subscribe** - Choose a tier and subscribe with SUI
4. **Access Content** - View exclusive content from your subscribed creators
5. **Send Tips** - Support creators with direct tips

## 🔐 Security & Privacy

### Encryption
- All non-public content is encrypted with **real @mysten/seal SDK** (Identity-Based Encryption)
- **IBE Scheme**: BonehFranklinBLS12381DemCCA (BLS12-381 curve)
- **Symmetric Encryption**: AES-256-GCM for content encryption
- **Threshold Cryptography**: 1-of-2 key servers for decentralized key management
- **SessionKey Authorization**: `seal_approve` transactions required for decryption

### Access Control
- Encryption keys are managed on-chain via access policies
- Subscription verification happens on-chain (trustless, no server needed)
- Tier-based access: Each subscription tier has unique encryption keys
- On-chain proof required before decryption can occur

### Data Protection
- No centralized server can access encrypted content (only encrypted blobs stored)
- Walrus ensures content is distributed and always available (censorship-resistant)
- Profile images and content stored on Walrus (not centralized servers)
- IndexedDB cache cleared on logout/subscription expiry (privacy-first)

### Performance
- **File size limit**: 5MB per upload (optimized for Seal encryption performance)
- **Encryption timeout**: 10 minutes (for large files)
- **Decryption timeout**: 3 minutes (with caching, usually <1s)

## 🎯 Hackathon Track: Data Security & Privacy

### The Problem
Creators need to monetize exclusive content, but centralized platforms:
- Can access/leak private content
- Control creator-fan relationships  
- Take 5-30% fees
- Can censor or ban creators
- Store user data on centralized servers

### Walron's Solution: Privacy-First Architecture
Built entirely on the Sui Stack with **real production implementations**:

**🔐 Seal Encryption (Real @mysten/seal SDK)**
- **Identity-Based Encryption (IBE)**: BonehFranklinBLS12381DemCCA + AES-256-GCM
- **Tier-based access policies**: Each subscription tier gets unique encryption keys
- **Threshold cryptography**: 1-of-2 key servers for decentralized key management
- **SessionKey authorization**: `seal_approve` transactions for secure decryption
- **Production key servers**: Using verified, fast key servers on testnet
- **Only verified subscribers can decrypt**: On-chain proof required before decryption

**🌐 Walrus Storage (Decentralized Blob Storage)**
- **Censorship-resistant**: Content distributed across multiple nodes
- **Verifiable content integrity**: Blob IDs stored on-chain for verification
- **No single point of failure**: Decentralized architecture
- **Profile images & content**: Both stored on Walrus for true decentralization

**⛓️ On-Chain Verification (Trustless Access Control)**
- **Subscription NFTs**: Prove membership on-chain (`has key, store`)
- **Access checks happen on-chain**: No server-side verification needed
- **Zero-knowledge-like**: Content never exposed, only access rights verified
- **Transparent, auditable policies**: All access logic visible on blockchain
- **SuiNS integration**: Human-readable identity verification

**🎯 Result**
Creators fully control their content and revenue, fans get verifiable access, and privacy is guaranteed by **cryptography**—not trust in a platform. This is the first fully working decentralized Patreon with end-to-end encryption.

## 📊 Deployment

### Testnet Deployment

- **Package ID**: Set via `NEXT_PUBLIC_PACKAGE_ID` environment variable
- **Network**: Sui Testnet
- **Default Package ID** (fallback): `0xdbd66ba1348f60cdac421c2da4a09d2f56a48fa64963307b3842896258723e35`
- **Explorer**: [View on SuiScan](https://suiscan.xyz/testnet/) (use your deployed package ID)

> **Note**: Update `NEXT_PUBLIC_PACKAGE_ID` in `.env.local` with your deployed package ID after publishing contracts.


## 🎥 Demo

[Demo video link will be added here]

### Key Demo Points

1. Creator profile creation
2. Subscription tier setup
3. Content upload with encryption
4. Fan subscribing to creator
5. Accessing encrypted content
6. Sending tips

## 🔮 Future Enhancements

### Planned for V2
- **zkLogin/Passkeys**: Passwordless, privacy-preserving authentication (Sui Stack feature)
- **Direct Messaging**: Encrypted creator-fan communication
- **Content Bundles**: Package multiple content pieces together
- **Comments & Community**: Fan engagement with creator posts
- **Auto-Renewal**: Automatic subscription renewals
- **Multi-Tier Access**: Subscribe to multiple tiers simultaneously
- **NFT Gating**: Use existing NFTs as access keys
- **Advanced Analytics**: Detailed revenue breakdowns and growth charts
- **Livestream Support**: Real-time encrypted streaming with Walrus

## 🏆 Why Walron Stands Out

### ✅ Complete RFP Implementation
This project delivers on **all core requirements** of the Web3 Patreon RFP:
- ✅ Direct creator–fan relationships without intermediaries
- ✅ Programmable monetization models (subscriptions + tipping)
- ✅ Encrypted, verifiable content access with onchain rules
- ✅ Privacy-first architecture (Seal IBE + Walrus storage)
- ✅ Global, censorship-resistant infrastructure (Walrus)
- ✅ All major deliverables implemented and working

### 🔐 Track Excellence: Data Security & Privacy
Perfect fit for the **Data Security & Privacy** track:
- **Real Seal SDK**: Production-ready IBE encryption (not mock implementation)
- **Threshold Cryptography**: Decentralized key management (1-of-2 servers)
- **On-Chain Access Control**: Trustless verification via Subscription NFTs
- **Walrus Integration**: Verifiable, censorship-resistant storage
- **Zero Server Trust**: Content encrypted before upload, only subscribers decrypt

### 🚀 Technical Innovation
- **Complete Sui Stack Integration**: Sui + Walrus + Seal + SuiNS working together
- **Subscription NFT Composability**: `has key, store` enables secondary markets
- **Identity-Based Encryption**: Fine-grained tier access without complex key management
- **Smart Caching**: IndexedDB reduces decryption overhead by 99% (5-8s → 0.1s)
- **Portable Identity**: SuiNS + unique handles + on-chain profiles

### 🎨 User Experience
- **Familiar Interface**: Patreon-like UX for easy onboarding
- **Real-Time Features**: Handle validation, transaction confirmations, live analytics
- **Profile Customization**: Full editing with Walrus-hosted images
- **Instant Content Access**: Sub-second loads after first decrypt

## 📄 License

MIT License - see LICENSE file for details

## 👥 Team

Built solo for the Walrus Haulout Hackathon

## 🙏 Acknowledgments

- Sui Foundation for the amazing blockchain platform
- Walrus Protocol for decentralized storage
- Seal Protocol for encryption capabilities
- DeepSurge platform for hackathon hosting

## 📧 Contact

For questions or feedback, reach out via:
- GitHub Issues
- Twitter: [Your Twitter]
- Email: [Your Email]

---

**Built with ❤️ on the Sui Stack**

