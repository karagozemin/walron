# Web3 Patreon - Decentralized Creator Platform

> Built for the Walrus Haulout Hackathon 2024

A fully decentralized Patreon alternative built on the Sui Stack, featuring encrypted content storage with Seal and distributed hosting on Walrus.

## 🌟 Overview

Web3 Patreon empowers creators to monetize their content directly on-chain without intermediaries. Fans get transparent, verifiable access to exclusive content, and creators maintain full ownership of their identity and content.

## ✨ Key Features

- **Creator Profiles**: Portable, on-chain identity that persists beyond any single platform
- **Encrypted Content**: All private content encrypted with Seal protocol
- **Decentralized Storage**: Content stored on Walrus for censorship resistance
- **Subscription NFTs**: Tradeable, transferable membership tokens
- **Direct Payments**: 100% of subscription fees go directly to creators
- **Multiple Tiers**: Create unlimited subscription tiers with custom pricing
- **Pay-Per-View**: Option for one-time content purchases
- **Tips**: Direct tipping functionality for instant support

## 🏗️ Architecture

### Tech Stack

- **Blockchain**: Sui (Smart contracts in Move)
- **Storage**: Walrus Protocol (Decentralized blob storage)
- **Encryption**: Seal Protocol (Content encryption and access control)
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Wallet**: @mysten/dapp-kit

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
NEXT_PUBLIC_PACKAGE_ID=0x82ab86dee8814eeae26b76d33cd7ddacc280794a0596f6e82939451052ac02b3
```

### Running Locally

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📝 Usage Guide

### For Creators

1. **Connect Wallet** - Click "Connect Wallet" in the header
2. **Create Profile** - Go to Dashboard and create your creator profile
3. **Set Up Tiers** - Create subscription tiers with custom pricing
4. **Upload Content** - Upload encrypted content for your subscribers
5. **Share Profile** - Share your profile link with fans

### For Fans

1. **Connect Wallet** - Connect your Sui wallet
2. **Explore Creators** - Browse creators on the Explore page
3. **Subscribe** - Choose a tier and subscribe with SUI
4. **Access Content** - View exclusive content from your subscribed creators
5. **Send Tips** - Support creators with direct tips

## 🔐 Security & Privacy

- All non-public content is encrypted with Seal before upload
- Encryption keys are managed on-chain via access policies
- Subscription verification happens on-chain (trustless)
- No centralized server can access encrypted content
- Walrus ensures content is distributed and always available

## 🎯 Hackathon Tracks

This project fits into the following tracks:

### Primary Track: **Data Security & Privacy**
- Implements Seal encryption for content protection
- On-chain access control via Subscription NFTs
- Zero-knowledge content access verification

### Secondary Track: **Data Economy/Marketplaces**
- Creates a marketplace for creator content
- Tradeable subscription NFTs
- Direct creator-fan economic relationships

## 📊 Deployment

### Testnet Deployment

- **Package ID**: `0x82ab86dee8814eeae26b76d33cd7ddacc280794a0596f6e82939451052ac02b3`
- **Network**: Sui Testnet
- **Explorer**: [View on SuiScan](https://suiscan.xyz/testnet/object/0x82ab86dee8814eeae26b76d33cd7ddacc280794a0596f6e82939451052ac02b3)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment details.

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

- **SuiNS Integration**: Use .sui handles for creator profiles
- **zkLogin**: Passwordless authentication for better UX
- **Analytics Dashboard**: Revenue tracking and subscriber insights
- **Direct Messaging**: Encrypted creator-fan communication
- **Content Bundles**: Package multiple content pieces together
- **Auto-Renewal**: Automatic subscription renewals
- **Multi-Tier Access**: Subscribe to multiple tiers simultaneously
- **NFT Gating**: Use existing NFTs as access keys
- **Cross-Platform**: Export access rights to other compatible platforms

## 🏆 What Makes This Special

### Technical Excellence
- Full integration of Sui Stack (Sui + Walrus + Seal)
- Production-ready Move contracts with proper error handling
- Seamless encryption/decryption flow
- Gas-efficient contract design

### Innovation
- First decentralized Patreon with encrypted content
- Subscription NFTs enable secondary markets
- Composable access control (use anywhere)
- True content ownership for creators

### User Experience
- Clean, intuitive UI/UX
- Familiar Patreon-like interface
- Progressive onboarding
- Clear transaction feedback

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

