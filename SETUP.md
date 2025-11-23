# Setup Guide - Web3 Patreon

This guide will help you set up and run the Web3 Patreon project locally.

## Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Sui CLI** (for contract deployment)
- **Git**
- A **Sui wallet** (Sui Wallet or Suiet browser extension)
- **Testnet SUI tokens** (get from [Sui Testnet Faucet](https://faucet.testnet.sui.io/))

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd wal
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
NEXT_PUBLIC_PACKAGE_ID=0xdbd66ba1348f60cdac421c2da4a09d2f56a48fa64963307b3842896258723e35
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Connect Wallet

1. Install Sui Wallet or Suiet browser extension
2. Create a wallet or import existing one
3. Switch to **Testnet** network
4. Get testnet tokens from [faucet](https://faucet.testnet.sui.io/)
5. Click "Connect Wallet" on the website

## Smart Contract Deployment (Optional)

If you want to deploy your own instance:

### 1. Install Sui CLI

```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

### 2. Configure Sui Client

```bash
sui client
```

Select testnet and create/import a wallet.

### 3. Build Contracts

```bash
cd contracts
sui move build
```

### 4. Deploy Contracts

```bash
sui client publish --gas-budget 100000000
```

### 5. Update Package ID

Copy the Package ID from deployment output and update `.env.local`:

```env
NEXT_PUBLIC_PACKAGE_ID=<your-package-id>
```

## Usage Guide

### For Creators

1. **Connect Wallet**
   - Click "Connect Wallet" in header
   - Approve connection in wallet extension

2. **Create Profile**
   - Go to Dashboard
   - Fill in handle and bio
   - Click "Create Profile"
   - Approve transaction in wallet

3. **Create Subscription Tier**
   - In Dashboard, scroll to "Create Subscription Tier"
   - Enter tier name (e.g., "Basic", "Premium")
   - Set price in SUI
   - Add description
   - Set max subscribers
   - Click "Create Tier"

4. **Upload Content**
   - Scroll to "Upload Content" section
   - Select a file (image, video, audio, PDF)
   - Enter title and description
   - Choose if content is public or private
   - For private: select tier for subscription access
   - Click "Upload Content"
   - Wait for encryption → upload → on-chain record

### For Fans

1. **Explore Creators**
   - Go to "Explore Creators" page
   - Browse available creators

2. **Visit Creator Profile**
   - Click on a creator card
   - View their profile and subscription tiers

3. **Subscribe to Creator**
   - Choose a subscription tier
   - Click "Subscribe"
   - Approve payment transaction
   - Receive Subscription NFT

4. **Access Content**
   - Subscribed content will automatically decrypt
   - Public content is available to everyone
   - Locked content shows lock icon

5. **Send Tips**
   - Click "Send Tip" button
   - Enter amount and optional message
   - Approve transaction

## Troubleshooting

### Wallet Connection Issues

- Make sure you're on Testnet network
- Refresh page after switching networks
- Clear browser cache if issues persist

### Transaction Failures

- Ensure you have enough SUI for gas
- Check if you're on the correct network
- Verify Package ID is correct

### Upload Issues

- Check file size (recommended < 50MB)
- Ensure stable internet connection
- Walrus testnet may have rate limits

### Content Not Decrypting

- Verify you have an active subscription
- Check subscription hasn't expired
- Clear localStorage and try again

## Development Tips

### Hot Reload

The dev server supports hot reload. Changes to code will reflect immediately.

### Testing Transactions

Use small amounts of SUI for testing:
- 0.1 SUI for profile creation
- 0.5-1 SUI for subscriptions
- 0.1 SUI for content uploads

### Debugging

```bash
# View browser console for frontend errors
# Check terminal for Next.js errors
npm run dev

# Build for production testing
npm run build
npm start
```

## Project Structure

```
wal/
├── contracts/              # Sui Move contracts
│   ├── sources/           # Contract source files
│   └── Move.toml         # Package manifest
├── frontend/              # Next.js application
│   ├── app/              # App router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities & services
│   └── public/           # Static assets
├── README.md             # Project documentation
├── DEPLOYMENT.md         # Deployment info
├── SETUP.md             # This file
└── HACKATHON_SUBMISSION.md  # Submission details
```

## Resources

- [Sui Documentation](https://docs.sui.io/)
- [Walrus Docs](https://docs.walrus.site/)
- [Seal Workshop](https://go.sui.io/intro-seal)
- [Next.js Docs](https://nextjs.org/docs)
- [Sui Testnet Faucet](https://faucet.testnet.sui.io/)

## Support

For issues or questions:
- Check existing GitHub issues
- Create a new issue with details
- Contact via Discord/Twitter

## License

MIT License - see LICENSE file

