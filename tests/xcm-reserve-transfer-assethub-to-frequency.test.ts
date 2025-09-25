import { describe, it, expect, assert } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';
import { getAccountBalance, getForeignAssetBalance } from './util.js';

const { checkSystemEvents, checkHrmp } = withExpect(expect);

import networks, { type Network } from './networks.js';

// npm run test xcm-reserve-transfer-assethub-to-frequency.test.ts
describe('XCM limited reserve transfer from AssetHub to Frequency', async () => {
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

  it('From AssetHub send DOT to Frequency', async () => {
    await connectParachains([assetHub.chain, frequency.chain], false);

    const { alice, bob } = testingPairs();

    const DOT_UNIT = 10_000_000_000n; // 1 DOT = 10^10 smallest units
    const FREQUENCY_UNIT = 100_000_000n; // 1 Frequency = 10^8 smallest units

    // Parachain IDs
    const FREQUENCY_PARA_ID = 2091;

    // Test amounts
    const ALICE_INITIAL_ASSETHUB_BALANCE = 1000n * DOT_UNIT;
    const ALICE_INITIAL_FREQUENCY_BALANCE = 10n * FREQUENCY_UNIT;
    const TRANSFER_AMOUNT = 50n * DOT_UNIT;

    // Seed Alice and Bob account on AssetHub
    await setStorage(assetHub.chain, {
      System: {
        Account: [
          [
            [alice.address],
            { providers: 1, data: { free: ALICE_INITIAL_ASSETHUB_BALANCE }, nonce: 1 },
          ], // Give alice balance
        ],
      },
    });

    await setStorage(frequency.chain, {
      // Seed Alice account on Frequency
      System: {
        Account: [
          [[alice.address], { providers: 1, data: { free: ALICE_INITIAL_FREQUENCY_BALANCE } }],
        ],
      },
      // Create DOT asset on Frequency with Alice as owner
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            { supply: 1000n * DOT_UNIT, owner: alice.address, isSufficient: true },
          ],
        ],
        Account: [],
      },
    });

    await assetHub.chain.newBlock();

    // Step 1: Define the destination (Frequency parachain)
    const destination = {
      V3: {
        parents: 1,
        interior: { X1: { Parachain: FREQUENCY_PARA_ID } },
      },
    };

    // Step 2: Define the beneficiary (Bob on Frequency)
    const beneficiary = {
      V3: {
        parents: 0,
        interior: {
          X1: {
            AccountId32: {
              network: null,
              id: bob.addressRaw,
            },
          },
        },
      },
    };

    // Step 3: Define the asset to transfer (DOT)
    const transferAsset = {
      V3: [
        {
          id: {
            Concrete: {
              parents: 1,
              interior: 'Here',
            },
          },
          fun: { Fungible: TRANSFER_AMOUNT },
        },
      ],
    };

    let assetHubTx = await assetHub.api.tx.polkadotXcm.limitedReserveTransferAssets(
      destination,
      beneficiary,
      transferAsset,
      0,
      'Unlimited'
    );

    await sendTransaction(assetHubTx.signAsync(alice));

    // Process the message on AssetHub
    await assetHub.chain.newBlock();

    // Check HRMP messages from AssetHub
    await checkHrmp(assetHub)
      .redact({ redactKeys: /setTopic/ })
      .toMatchSnapshot('outbound-hrmp-messages');

    // Check system events from AssetHub
    await checkSystemEvents(assetHub).toMatchSnapshot('assethhub-initial-events');

    // Check that the message was processed on Frequency
    await frequency.chain.newBlock();
    await checkSystemEvents(frequency, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot(
      'AssetHub chain xcm events'
    );

    // Check final balances
    const aliceAssetHubBalance = await getAccountBalance(assetHub.api, alice.address);
    const bobFrequencyBalance = await getForeignAssetBalance(
      frequency.api,
      { parents: 1, interior: 'Here' },
      bob.address
    );

    console.log('Alice AssetHub balance:', aliceAssetHubBalance.toString());
    console.log('Bob Frequency balance:', bobFrequencyBalance.toString());

    // Verify Alice's AssetHub balance decreased (due to transfer + fees)
    assert(
      aliceAssetHubBalance < ALICE_INITIAL_ASSETHUB_BALANCE,
      `Alice should have less than ${ALICE_INITIAL_ASSETHUB_BALANCE} DOT on AssetHub but has ${aliceAssetHubBalance}`
    );

    // Verify Bob received the transferred DOT (minus fees)
    const expectedMinBobBalance = TRANSFER_AMOUNT - 2n * DOT_UNIT; // Account for fees
    const expectedMaxBobBalance = TRANSFER_AMOUNT;
    assert(
      bobFrequencyBalance >= expectedMinBobBalance && bobFrequencyBalance <= expectedMaxBobBalance,
      `Bob should have between ${expectedMinBobBalance} and ${expectedMaxBobBalance} DOT on Frequency but has ${bobFrequencyBalance}`
    );
  }, 240000);
});
