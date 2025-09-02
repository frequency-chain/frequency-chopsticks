# Frequency Chopsticks XCM Testing Environment

This project provides a complete testing environment for XCM transfers between Frequency parachain and AssetHub using Chopsticks.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the XCM testing environment:
```bash
# Option 1: Using the XCM configuration (recommended)
npm run fork:xcm

# Option 2: Start chains individually  
npm run fork:frequency  # Terminal 1
npm run fork:asset-hub  # Terminal 2
```

3. Run the tests:
```bash
npm test
```

## Chain Endpoints

When the forks are running, you can connect to:
- **Relay Chain (Polkadot)**: ws://localhost:8000
- **AssetHub**: ws://localhost:8001  
- **Frequency**: ws://localhost:8002

## Test Accounts

The configuration includes pre-funded test accounts:
- **Alice**: `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`
- **Bob**: `5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty`

Alice has:
- 1,000,000 DOT on both chains
- 500,000 USDC (asset ID 1337) on AssetHub

## Available Scripts

- `npm test` - Run all XCM tests
- `npm run fork:xcm` - Start XCM testing environment with relay + parachains
- `npm run fork:frequency` - Start only Frequency parachain fork
- `npm run fork:asset-hub` - Start only AssetHub fork

## Test Structure

- `tests/setup.ts` - Test environment setup and chain connections
- `tests/xcm-utils.ts` - XCM utility functions and helpers
- `tests/xcm-transfer.test.ts` - XCM transfer test cases

## Configuration Files

- `configs/frequency.yml` - Frequency parachain configuration
- `configs/asset-hub.yml` - AssetHub configuration  
- `configs/xcm-setup.yml` - Multi-chain XCM testing configuration

## Usage Example

```typescript
import { setupTestEnvironment, cleanupTestEnvironment } from './tests/setup'
import { createXcmTransfer } from './tests/xcm-utils'

// Setup test environment
const { chains, accounts } = await setupTestEnvironment()

// Create XCM transfer
const xcmTransfer = await createXcmTransfer(
  chains.assetHub,
  chains.frequency,
  {
    from: accounts.alice,
    to: accounts.bob.address,
    amount: '1000000', // 1 USDC
    assetId: 1337
  }
)

// Execute transfer
const tx = chains.assetHub.tx.polkadotXcm.limitedReserveTransferAssets(
  xcmTransfer.destination,
  xcmTransfer.beneficiary,
  xcmTransfer.assets,
  xcmTransfer.feeAssetItem,
  'Unlimited'
)

await tx.signAndSend(accounts.alice)

// Cleanup
await cleanupTestEnvironment(chains)
```

## Troubleshooting

1. **Connection issues**: Ensure the chains are fully synced before running tests
2. **XCM failures**: Check that HRMP channels are open between parachains
3. **Asset not found**: Verify asset IDs match the configured assets in AssetHub
4. **Timeout errors**: Increase test timeouts in `vitest.config.ts` if needed

## Notes

- Frequency parachain ID: 2091
- AssetHub parachain ID: 2000  
- USDC asset ID: 1337
- All chains use mock signature host for testing