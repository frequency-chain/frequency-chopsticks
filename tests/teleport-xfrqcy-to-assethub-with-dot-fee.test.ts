import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import networks, { type Network } from './networks';
import { describe, it, expect } from 'vitest';
import { withExpect } from '@acala-network/chopsticks-testing';
import { setStorage } from '@acala-network/chopsticks';
import { getSiblingSovereignAccount } from './util';
import { getAccountBalance, getForeignAssetBalance } from './util';

import { connectParachains } from '@acala-network/chopsticks';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

describe('Teleport XFRQCY to AssetHub with DOT fee', () => {
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

  it('Teleport XFRQCY to AssetHub with DOT fee', async () => {
    await connectParachains([frequency.chain, assetHub.chain], false);
    const { alice, bob } = testingPairs();

    // Token unit definitions (smallest units per token)
    const DOT_UNIT = 10_000_000_000n;        // 1 DOT = 10^10 smallest units
    const FREQUENCY_UNIT = 100_000_000n;     // 1 Frequency = 10^8 smallest units
    
    // Parachain IDs
    const FREQUENCY_PARA_ID = 2091;
    const ASSETHUB_PARA_ID = 1000;
    
    // Test amounts (in token units)
    const FREQUENCY_SUPPLY_AMOUNT = 10000n;  // 10,000 Frequency (total supply)
    
    // Convert to smallest units for blockchain operations
    const FREQUENCY_SUPPLY_SMALLEST = FREQUENCY_SUPPLY_AMOUNT * FREQUENCY_UNIT;

    const frequencySovereignAccount = await getSiblingSovereignAccount(FREQUENCY_PARA_ID);

    await setStorage(assetHub.chain, {
      System: {
        Account: [
          [[alice.address], { data: { free: 1000n * DOT_UNIT } }],
          [[frequencySovereignAccount], { data: { free: 1000n * DOT_UNIT } }],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } }],
            { supply: FREQUENCY_SUPPLY_SMALLEST, owner: alice.address, isSufficient: true },
          ],
        ],
      },
    });

    await setStorage(frequency.chain, {
      System: {
        Account: [
          [[alice.address], { providers: 1, data: { free: 1000n * FREQUENCY_UNIT } }],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            { supply: 1000n * DOT_UNIT, owner: alice.address, isSufficient: true },
          ],
        ],
        Account: [
          [
            [
              {
                parents: 1,
                interior: 'Here',
              },
              alice.address,
            ],
            {
              balance: 100n * DOT_UNIT,
              status: { Liquid: null },
              reason: { Consumer: null },
              extra: null,
            },
          ],
        ],
      },
      PolkadotXcm: {
        SafeXcmVersion: 4,
        SupportedVersion: [
          [
            [
              5,
              {
                V5: { parents: 1, interior: { X1: [{ Parachain: ASSETHUB_PARA_ID }] } },
              },
            ],
            5,
          ],
        ],
      },
    });

    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-frequency-check-system-account'
    );
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-assethub-check-system-account'
    );

    await check(
      frequency.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: 'Here',
        },
        alice.address
      )
    ).toMatchSnapshot('frequency-check-foreign-assets-account');

    // Step 1: Define the assets to withdraw
    const frequencyAsset = {
      id: { parents: 0, interior: 'here' },
      fun: { Fungible: 100n * FREQUENCY_UNIT },  // 100 Frequency
    };
    
    const dotAsset = {
      id: { parents: 1, interior: 'here' },
      fun: { Fungible: 10n * DOT_UNIT },  // 10 DOT
    };
    
    // Step 2: Define remote fees (withdrawn from destination chain)
    const remoteFeeAsset = {
      id: { parents: 1, interior: 'here' },
      fun: { Fungible: 3n * DOT_UNIT },  // 3 DOT remote fee
    };
    
    // Step 3: Define teleport assets (what gets teleported)
    const teleportAsset = {
      id: { parents: 0, interior: 'here' },
      fun: { Fungible: 100n * FREQUENCY_UNIT },  // 100 Frequency to teleport
    };
    
    // Step 4: Define beneficiary (who receives the assets)
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
    
    // Step 5: Build the complete XCM message
    const xcm = {
      V5: [
        {
          WithdrawAsset: [frequencyAsset, dotAsset],
        },
        {
          InitiateTransfer: {
            destination: {
              parents: 1,
              interior: { X1: [{ Parachain: ASSETHUB_PARA_ID }] },
            },
            remoteFees: {
              ReserveWithdraw: {
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
      ],
    };

    await frequency.chain.newBlock();

    const tx = await frequency.api.tx.polkadotXcm.execute(xcm, {
      refTime: 8000000000,
      proofSize: 200000,
    });

    await sendTransaction(tx.signAsync(alice));

    await frequency.chain.newBlock();

    await checkHrmp(frequency)
      .redact({ redactKeys: /setTopic/ })
      .toMatchSnapshot('frequency-outbound-hrmp-messages');

    await checkSystemEvents(frequency).toMatchSnapshot('frequency-events-after-xcm');

    await assetHub.chain.newBlock();

    await checkSystemEvents(assetHub, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot(
      'assethub xcm chain events'
    );

    // Check final balance of alice in frequency
    const aliceFrequencyBalance = await frequency.api.query.system.account(alice.address);
    await check(aliceFrequencyBalance).toMatchSnapshot('frequency-final-balance');
    
    const aliceBalance = await getAccountBalance(frequency.api, alice.address);
    const expectedMinBalance = 1000n * FREQUENCY_UNIT - 100n * FREQUENCY_UNIT;
    assert(
      aliceBalance < expectedMinBalance,
      `Alice should have less than ${expectedMinBalance} Frequency, but has ${aliceBalance}`
    );

    // Check final balance of alice DOT on frequency
    const aliceDotAccount = await frequency.api.query.foreignAssets.account(
      {
        parents: 1,
        interior: 'Here',
      },
      alice.address
    );
    await check(aliceDotAccount).toMatchSnapshot('frequency-final-balance');
    
    const aliceDotBalance = await getForeignAssetBalance(
      frequency.api,
      { parents: 1, interior: 'Here' },
      alice.address
    );
    assert(
      aliceDotBalance < 100n * DOT_UNIT,
      `Alice should have less than ${100n * DOT_UNIT} DOT, but has ${aliceDotBalance}`
    );

    // Check final balances for receiving account
    const bobForeignAssets = await assetHub.api.query.foreignAssets.account(
      {
        parents: 1,
        interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] },
      },
      bob.address
    );
    await check(bobForeignAssets).toMatchSnapshot('assethub-final-balance');
    
    const bobBalance = await getForeignAssetBalance(
      assetHub.api,
      { parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } },
      bob.address
    );
    const expectedBobBalance = 100n * FREQUENCY_UNIT;
    assert(
      bobBalance === expectedBobBalance,
      `Bob should have ${expectedBobBalance} Frequency, but has ${bobBalance}`
    );
  });
}, 240000);
