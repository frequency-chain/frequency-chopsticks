import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectVertical } from '@acala-network/chopsticks';
import { getAccountBalance, getForeignAssetBalance } from './util.js';

const { checkSystemEvents } = withExpect(expect);

import networks, { type Network } from './networks.js';

describe('XCM', async () => {
  let frequency: Network;
  let polkadot: Network;

  beforeEach(async () => {
    frequency = await networks.frequency();
    polkadot = await networks.polkadot();
  });

  afterAll(async () => {
    await frequency.teardown();
    await polkadot.teardown();
  });

  it('Polkadot send downward messages to frequency', async () => {
    await connectVertical(polkadot.chain, frequency.chain);

    const { alice, bob } = testingPairs();

    // Token unit definitions (smallest units per token)
    const DOT_UNIT = 10_000_000_000n; // 1 DOT = 10^10 smallest units
    const FREQUENCY_UNIT = 100_000_000n; // 1 Frequency = 10^8 smallest units

    // Parachain IDs
    const FREQUENCY_PARA_ID = 2091;

    setStorage(polkadot.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000n * DOT_UNIT }, providers: 1 }]],
      },
    });

    setStorage(frequency.chain, {
      System: {
        Account: [[[bob.address], { data: { free: 1000n * FREQUENCY_UNIT }, providers: 1 }]],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            { supply: 0n * DOT_UNIT, owner: alice.address, isSufficient: true },
          ],
        ],
      },
    });

    // Step 1: Define the destination (Frequency parachain)
    const destination = {
      V5: { parents: 0, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } },
    };

    // Step 2: Define the beneficiary (Bob on Frequency)
    const beneficiary = {
      V5: {
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
      },
    };

    // Step 3: Define the asset to transfer (DOT)
    const transferAsset = {
      V5: [
        {
          id: { Concrete: { parents: 0, interior: 'Here' } },
          fun: { Fungible: 100n * DOT_UNIT },
        },
      ],
    };

    const tx = await polkadot.api.tx.xcmPallet.reserveTransferAssets(
      destination,
      beneficiary,
      transferAsset,
      0
    );

    await sendTransaction(tx.signAsync(alice));

    await polkadot.chain.newBlock();
    await checkSystemEvents(polkadot).toMatchSnapshot('polkadot-events');

    // Frequency should receive the downward message
    await frequency.chain.newBlock();
    await checkSystemEvents(frequency).toMatchSnapshot('frequency-receive-events');

    // Check final balances
    const alicePolkadotBalance = await getAccountBalance(polkadot.api, alice.address);
    assert(
      alicePolkadotBalance < 1000n * DOT_UNIT - 100n * DOT_UNIT,
      'Alice should have less than 900 DOT on Polkadot but has ' + alicePolkadotBalance.toString()
    );

    // 100 DOT was transferred to bob but about 1 DOT was used to pay the fee.
    const bobDotBalance = await getForeignAssetBalance(
      frequency.api,
      { parents: 1, interior: 'Here' },
      bob.address
    );
    assert(
      99n * DOT_UNIT < bobDotBalance && bobDotBalance < 100n * DOT_UNIT,
      'Bob should have 100 DOT on Frequency but has ' + bobDotBalance.toString()
    );

    console.log('Alice Polkadot balance:', alicePolkadotBalance.toString());
  });
}, 240000);
