import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';
import { KeyringPair } from '@polkadot/keyring/types';
import { checkingAccount } from './util.js';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

import networks, { type Network } from './networks.js';

// Interface for AssetHub setup configuration
interface AssetHubSetupConfig {
  nativeBalance: BigInt; // Native DOT balance for account
  foreignAssetBalance: BigInt; // Frequency foreign asset balance
  foreignAssetSupply: BigInt; // Total supply of foreign asset
  foreignAssetParaId: number; // Frequency parachain ID
  xcmVersion?: number; // XCM version (default: 5)
}

// Interface for Frequency setup configuration
interface FrequencySetupConfig {
  nativeBalance: BigInt; // Native balance for account
  foreignAssetBalance: BigInt; // DOT foreign asset balance
  foreignAssetSupply: BigInt; // Total supply of foreign asset
  foreignAssetParaId: number; // AssetHub parachain ID
  xcmVersion?: number; // XCM version (default: 5)
  checkingAccountBalance?: BigInt; // Checking account
}

describe('Teleport DOT from AssetHub to Frequency with DOT fee', () => {
  let frequency: Network;
  let assetHub: Network;

  beforeEach(async () => {
    frequency = await networks.frequency();
    assetHub = await networks.assetHub();
  });

  afterAll(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });

  /**
   * Tests teleporting DOT from AssetHub to Frequency with DOT fee payment.
   * This test verifies the XCM teleport functionality between parachains.
   * Alice from AssetHub sends Frequency to Bob on Frequency.
   * Note that bob started with 0 Frequency.
   *
   * Expected behavior:
   * - Alice teleports DOT from AssetHub to Frequency
   * - DOT fee is paid for the teleport operation
   * - Bob receives the teleported Native on Frequency
   */
  it('Teleport DOT from AssetHub to Frequency with DOT fee', async () => {
    await connectParachains([assetHub.chain, frequency.chain], false);

    const { alice, bob }: { alice: KeyringPair; bob: KeyringPair } = testingPairs();

    // Token unit definitions (smallest units per token)
    const DOT_UNIT = 10_000_000_000n; // 1 DOT = 10^10 smallest units
    const FREQUENCY_UNIT = 100_000_000n; // 1 Frequency = 10^8 smallest units

    // Parachain IDs
    const FREQUENCY_PARA_ID = 2091;
    const ASSETHUB_PARA_ID = 1000;

    // Test amounts (in token units)
    const DOT_AMOUNT = 100n; // 100 DOT
    const FREQUENCY_AMOUNT = 100n; // 100 Frequency
    const FREQUENCY_SUPPLY_AMOUNT = 10000n; // 10,000 Frequency (total supply)

    // Convert to smallest units for blockchain operations
    const DOT_AMOUNT_SMALLEST = DOT_AMOUNT * DOT_UNIT;
    const FREQUENCY_AMOUNT_SMALLEST = FREQUENCY_AMOUNT * FREQUENCY_UNIT;
    const FREQUENCY_SUPPLY_SMALLEST = FREQUENCY_SUPPLY_AMOUNT * FREQUENCY_UNIT;

    // Setup AssetHub with DOT balance for alice
    await setupAssetHubStorage(assetHub.chain, alice, {
      nativeBalance: DOT_AMOUNT_SMALLEST,
      foreignAssetBalance: FREQUENCY_AMOUNT_SMALLEST,
      foreignAssetSupply: FREQUENCY_SUPPLY_SMALLEST,
      foreignAssetParaId: FREQUENCY_PARA_ID,
    });

    await setupFrequencyStorage(frequency.chain, alice, {
      nativeBalance: 1000n * FREQUENCY_UNIT,
      foreignAssetBalance: DOT_AMOUNT_SMALLEST,
      foreignAssetSupply: DOT_AMOUNT_SMALLEST * 10n,
      foreignAssetParaId: ASSETHUB_PARA_ID,
      checkingAccountBalance: FREQUENCY_SUPPLY_SMALLEST,
    });

    const bobFrequencyBalance = (
      await frequency.api.query.system.account(bob.address)
    ).data.free.toBigInt();
    assert(bobFrequencyBalance === 0n, 'Bob should have 0 Frequency');

    // assert(bobsDotBalanceOnFrequency === 0n, 'Bob should have 0 DOT on Frequency');

    // Build XCM message step by step for better readability

    // Step 1: Define the assets to withdraw
    const dotAsset = {
      id: { parents: 1, interior: 'here' },
      fun: { Fungible: 10n * DOT_UNIT }, // 10 DOT
    };

    const frequencyAsset = {
      id: { parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } },
      fun: { Fungible: 10n * FREQUENCY_UNIT }, // 10 Frequency
    };

    // Step 2: Define fee payment
    const feeAsset = {
      id: { parents: 1, interior: 'here' },
      fun: { Fungible: 2n * DOT_UNIT }, // 2 DOT fee
    };

    // Step 3: Define remote fees (deposited on destination chain)
    const remoteFeeAsset = {
      id: { parents: 1, interior: 'here' },
      fun: { Fungible: 3n * DOT_UNIT }, // 3 DOT remote fee
    };

    // Step 4: Define teleport assets (what gets teleported)
    const teleportAsset = {
      id: { parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } },
      fun: { Fungible: 10n * FREQUENCY_UNIT }, // 10 Frequency to teleport
    };

    // Step 5: Define beneficiary (who receives the assets)
    const beneficiary = {
      parents: 0,
      interior: {
        X1: [
          {
            AccountId32: {
              network: null,
              id: bob.addressRaw,
            },
          },
        ],
      },
    };

    // Step 6: Build the complete XCM message
    const xcm = {
      V5: [
        {
          WithdrawAsset: [dotAsset, frequencyAsset],
        },
        {
          PayFees: { asset: feeAsset },
        },
        {
          InitiateTransfer: {
            destination: {
              parents: 1,
              interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] },
            },
            remoteFees: {
              ReserveDeposit: {
                Definite: [remoteFeeAsset],
              },
            },
            preserveOrigin: false,
            assets: [
              {
                Teleport: {
                  Definite: [teleportAsset],
                },
              },
            ],
            remoteXcm: [
              // The DOT is refunded to Bob along with the deposit of Frequency alice sent to Bob.
              // We can adjust this to return the DOT fee to alice on Frequency
              {
                RefundSurplus: null,
              },
              {
                DepositAsset: {
                  assets: { Wild: { AllCounted: 2 } },
                  beneficiary: beneficiary,
                },
              },
            ],
          },
        },
        {
          RefundSurplus: null,
        },
        {
          DepositAsset: {
            assets: { Wild: { AllCounted: 1 } },
            beneficiary: {
              parents: 0,
              interior: {
                X1: [
                  {
                    AccountId32: {
                      network: null,
                      id: alice.addressRaw,
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    };

    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-frequency-check-system-account'
    );
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-assethub-check-system-account'
    );

    await check(
      assetHub.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] },
        },
        alice.address
      )
    ).toMatchSnapshot('assethub-check-alice-frequency-foreign-assets-account');

    // Create a block to ensure proper state
    await assetHub.chain.newBlock();

    const tx = await assetHub.api.tx.polkadotXcm.execute(xcm, {
      refTime: 8000000000,
      proofSize: 200000,
    });

    await sendTransaction(tx.signAsync(alice));

    await assetHub.chain.newBlock();

    // Check HRMP messages from AssetHub
    await checkHrmp(assetHub)
      .redact({ redactKeys: /setTopic/ })
      .toMatchSnapshot('assethub-outbound-hrmp-messages');

    await checkSystemEvents(assetHub).toMatchSnapshot('assethub-events-after-teleport');

    //  Process the message on Frequency
    await frequency.chain.newBlock();

    await checkSystemEvents(frequency, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot(
      'frequency-xcm-events-after-teleport'
    );

    // Check that bob received the teleported Frequency
    const bobFinalBalance = await getAccountBalance(frequency.api, bob.address);
    const expectedBobBalance = 10n * FREQUENCY_UNIT;

    assert(
      bobFinalBalance === expectedBobBalance,
      `Bob should have ${expectedBobBalance} Frequency, but has ${bobFinalBalance}`
    );
  });
}, 240000);

/**
 * Helper function to get account balance as BigInt
 * @param api - Polkadot API instance
 * @param address - Account address
 * @returns Account balance as BigInt
 */
const getAccountBalance = async (api: any, address: string): Promise<bigint> => {
  const accountData = await api.query.system.account(address);
  return accountData.data.free.toBigInt();
};

/**
 * Sets up AssetHub storage for XCM teleport testing
 * @param chain - AssetHub chain instance
 * @param account - Account to fund (typically Alice)
 * @param config - Configuration object with balances and parachain ID
 */
const setupAssetHubStorage = async (
  chain: any,
  account: KeyringPair,
  config: AssetHubSetupConfig
): Promise<void> => {
  // Constants for this function
  const XCM_VERSION = 5;
  const ACCOUNT_PROVIDERS = 1;
  const ASSET_STATUS = { Liquid: null };
  const ASSET_REASON = { Consumer: null };
  const IS_SUFFICIENT = true;

  const xcmVersion = config.xcmVersion ?? XCM_VERSION;

  await setStorage(chain, {
    System: {
      Account: [
        [
          [account.address],
          {
            data: { free: config.nativeBalance },
            providers: ACCOUNT_PROVIDERS,
          },
        ],
      ],
    },
    ForeignAssets: {
      Asset: [
        [
          [{ parents: 1, interior: { X1: [{ Parachain: config.foreignAssetParaId }] } }],
          {
            supply: config.foreignAssetSupply,
            owner: account.address,
            isSufficient: IS_SUFFICIENT,
          },
        ],
      ],
      Account: [
        [
          [
            {
              parents: 1,
              interior: { X1: [{ Parachain: config.foreignAssetParaId }] },
            },
            account.address,
          ],
          {
            balance: config.foreignAssetBalance,
            status: ASSET_STATUS,
            reason: ASSET_REASON,
            extra: null,
          },
        ],
      ],
    },
    PolkadotXcm: {
      SafeXcmVersion: xcmVersion,
      SupportedVersion: [
        [
          [
            xcmVersion,
            {
              V5: { parents: 1, interior: { X1: [{ Parachain: config.foreignAssetParaId }] } },
            },
          ],
          xcmVersion,
        ],
      ],
    },
  });
};

/**
 * Sets up Frequency storage for XCM teleport testing
 * @param chain - Frequency chain instance
 * @param account - Account to fund (typically Alice)
 * @param config - Configuration object with balances and parachain ID
 */
const setupFrequencyStorage = async (
  chain: any,
  account: KeyringPair,
  config: FrequencySetupConfig
): Promise<void> => {
  // Constants for this function
  const XCM_VERSION = 5;
  const ACCOUNT_PROVIDERS = 1;
  const ASSET_STATUS = { Liquid: null };
  const ASSET_REASON = { Consumer: null };
  const IS_SUFFICIENT = true;

  const xcmVersion = config.xcmVersion ?? XCM_VERSION;

  await setStorage(chain, {
    System: {
      Account: [
        [
          [account.address],
          {
            providers: ACCOUNT_PROVIDERS,
            data: { free: config.nativeBalance },
          },
        ],
        [
          [checkingAccount()],
          { data: { free: config.checkingAccountBalance }, providers: ACCOUNT_PROVIDERS },
        ],
      ],
    },
    ForeignAssets: {
      Asset: [
        [
          [{ parents: 1, interior: 'Here' }],
          {
            supply: config.foreignAssetSupply,
            owner: account.address,
            isSufficient: IS_SUFFICIENT,
          },
        ],
      ],
      Account: [
        [
          [
            {
              parents: 1,
              interior: 'Here',
            },
            account.address,
          ],
          {
            balance: config.foreignAssetBalance,
            status: ASSET_STATUS,
            reason: ASSET_REASON,
            extra: null,
          },
        ],
      ],
    },
    PolkadotXcm: {
      SafeXcmVersion: xcmVersion,
      SupportedVersion: [
        [
          [
            xcmVersion,
            {
              V5: { parents: 1, interior: { X1: [{ Parachain: config.foreignAssetParaId }] } },
            },
          ],
          xcmVersion,
        ],
      ],
    },
  });
};
