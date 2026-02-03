import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectVertical } from '@acala-network/chopsticks';
import { getChildSovereignAccount, getAccountBalance, getForeignAssetBalance } from './util.js';

const { checkSystemEvents, checkUmp } = withExpect(expect);

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

  it('frequency send upward messages to Polkadot', async () => {
    await connectVertical(polkadot.chain, frequency.chain);

    const { alice, bob } = testingPairs();

    const DOT_UNIT = 10_000_000_000n; // 1 DOT = 10^10 smallest units
    const FREQUENCY_UNIT = 100_000_000n; // 1 Frequency = 10^8 smallest units

    const FREQUENCY_FOREIGN_ASSET_DOT_SUPPLY = 1000n * DOT_UNIT;

    // const FREQUENCY_PARA_ID = 2091;
    const FREQUENCY_PARA_ID = 4000; // paseo

    const childSovereignAccount = await getChildSovereignAccount(FREQUENCY_PARA_ID);

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000n * FREQUENCY_UNIT }, providers: 1 }]],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'here' }],
            {
              supply: FREQUENCY_FOREIGN_ASSET_DOT_SUPPLY,
              owner: alice.address,
              isSufficient: true,
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
              alice.address,
            ],
            {
              balance: FREQUENCY_FOREIGN_ASSET_DOT_SUPPLY,
              status: { Liquid: null },
              reason: { Consumer: null },
              extra: null,
            },
          ],
        ],
      },
    });

    await setStorage(polkadot.chain, {
      System: {
        Account: [
          [[alice.address], { data: { free: 1000n * DOT_UNIT } }],
          [
            [childSovereignAccount],
            { data: { free: FREQUENCY_FOREIGN_ASSET_DOT_SUPPLY }, providers: 1 },
          ],
        ],
      },
    });

    assert(
      (await getAccountBalance(polkadot.api, alice.address)) === 1000n * DOT_UNIT,
      'Alice should have 1000 DOT on Polkadot'
    );
    assert(
      (await getAccountBalance(frequency.api, alice.address)) === 1000n * FREQUENCY_UNIT,
      'Alice should have 1000 Native on Frequency'
    );
    assert(
      (await getAccountBalance(frequency.api, bob.address)) === 0n,
      'Bob should have 0 Frequency'
    );
    assert(
      (await getForeignAssetBalance(
        frequency.api,
        { parents: 1, interior: 'Here' },
        alice.address
      )) === FREQUENCY_FOREIGN_ASSET_DOT_SUPPLY,
      'Alice should have 1000 DOT on Frequency'
    );

    // Step 1: Define the destination (Polkadot relay chain)
    const destination = {
      V5: {
        parents: 1,
        interior: 'here',
      },
    };

    // Step 2: Define the beneficiary (Bob on Polkadot)
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
          id: { parents: 1, interior: 'here' },
          fun: { Fungible: 100n * DOT_UNIT },
        },
      ],
    };

    const tx = await frequency.api.tx.polkadotXcm.limitedReserveTransferAssets(
      destination,
      beneficiary,
      transferAsset,
      0,
      'Unlimited'
    );

    await sendTransaction(tx.signAsync(alice));

    await frequency.chain.newBlock();
    await checkSystemEvents(frequency).toMatchSnapshot('frequency-events');

    await checkUmp(frequency).toMatchSnapshot('frequency-ump-events');

    await polkadot.chain.newBlock();

    // Check final balances
    const bobPolkadotBalance = await getAccountBalance(polkadot.api, bob.address);
    // 100 DOT was transferred to bob but about 1 DOT was used to pay the fee.
    // assert(
    //   99n * DOT_UNIT < bobPolkadotBalance && bobPolkadotBalance < 100n * DOT_UNIT,
    //   'Bob should have 100 DOT on Polkadot but has ' + bobPolkadotBalance.toString()
    // );

    await checkSystemEvents(polkadot).toMatchSnapshot('polkadot-events');
  });
}, 240000);
