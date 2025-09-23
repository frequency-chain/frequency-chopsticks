import { describe, it, expect } from 'vitest';
import { setStorage, DownwardMessage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectVertical } from '@acala-network/chopsticks';
import { getChildSovereignAccount } from './util.js';

const { check, checkSystemEvents, checkHrmp, checkUmp } = withExpect(expect);

import networks, { type Network } from './networks.js';

const downwardMessages: DownwardMessage[] = [
  {
    sentAt: 1,
    msg: '0x0210010400010000078155a74e390a1300010000078155a74e39010300286bee0d01000400010100c0cbffafddbe39f71f0190c2369adfc59eaa4c81a308ebcad88cdd9c400ba57c',
  },
];

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

  it.only('frequency send upward messages to Polkadot', async () => {
    await connectVertical(polkadot.chain, frequency.chain);

    const { alice, bob } = testingPairs();

    const childSovereignAccount = await getChildSovereignAccount(2091);
    console.log('childSovereignAccount', childSovereignAccount);

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 }, providers: 1 }]],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'here' }],
            { supply: 1000 * 1e12, owner: alice.address, isSufficient: true },
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
              balance: 100 * 1e12,
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
          [[alice.address], { data: { free: 1000 * 1e12 } }],
          [[childSovereignAccount], { data: { free: 1000 * 1e12 }, providers: 1 }],
        ],
      },
    });

    await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot(
      'alice-starting-balance-polkadot'
    );
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot(
      'alice-starting-balance-frequency'
    );
    await check(
      frequency.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: 'Here',
        },
        alice.address
      )
    ).toMatchSnapshot('alice-starting-balance-frequency-dot-foreign-assets');

    const tx = await frequency.api.tx.polkadotXcm.limitedReserveTransferAssets(
      {
        V5: {
          parents: 1,
          interior: 'here',
        },
      },
      {
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
      },
      {
        V5: [
          {
            id: { parents: 1, interior: 'here' },
            fun: { Fungible: 100 * 1e11 },
          },
        ],
      },
      0,
      'Unlimited'
    );

    await sendTransaction(tx.signAsync(alice));

    await frequency.chain.newBlock();
    await checkSystemEvents(frequency).toMatchSnapshot('frequency-events');

    await checkUmp(frequency).toMatchSnapshot('frequency-ump-events');

    await polkadot.chain.newBlock();

    // await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    await checkSystemEvents(polkadot).toMatchSnapshot('polkadot-events');
  });
}, 240000);
