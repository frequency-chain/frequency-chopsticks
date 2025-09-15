import { describe, it, expect } from 'vitest';
import { setStorage, DownwardMessage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectVertical } from '@acala-network/chopsticks';

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

    const blockNumberFrequency = (await frequency.api.rpc.chain.getHeader()).number.toNumber();
    frequency.dev.setHead(blockNumberFrequency);
  });

  afterAll(async () => {
    await frequency.teardown();
    await polkadot.teardown();
  });

  it('Frequency handles downward messages', async () => {
    console.log('Creating new block with downward messages...');
    await frequency.chain.newBlock({ downwardMessages });

    console.log('Checking system events...');
    const events = await frequency.api.query.system.events();
    console.log('Raw system events:', JSON.stringify(events.toHuman(), null, 2));

    await checkSystemEvents(frequency).toMatchSnapshot();
  });

  it.only('Polkadot send downward messages to frequency', async () => {
    await connectVertical(polkadot.chain, frequency.chain);

    const { alice, bob } = testingPairs();

    polkadot.dev.setStorage({
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 }, providers: 1 }]],
      },
    });

    frequency.dev.setStorage({
      System: {
        Account: [[[bob.address], { data: { free: 1000 * 1e10 }, providers: 1 }]],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
              { supply: 1000 * 1e10, owner: alice.address, isSufficient: true }
          ],
        ],    
        // Account: [
        //   [
        //     [{ parents: 1, interior: 'Here' }, bob.address],
        //     { balance: 100 * 1e10, status: { Liquid: null }, reason: { Consumer: null }, extra: null },
        //   ],
        // ],
      },
    });

    const tx = await polkadot.api.tx.xcmPallet.reserveTransferAssets(
      { V5: { parents: 0, interior: { X1: [{ Parachain: 2091 }] } } },
      {
        V5: {
          parents: 0,
          interior: {
            X1: [{
              AccountId32: {
                network: null,
                id: bob.addressRaw,
              },
            }],
          },
        },
      },
      {
        V5: [
          {
            id: { Concrete: { parents: 0, interior: 'Here' } },
            fun: { Fungible: 100 * 1e10 },
          }
        ],
      },
      0
    );

    await sendTransaction(tx.signAsync(alice));

    await polkadot.chain.newBlock();
    await checkSystemEvents(polkadot).toMatchSnapshot('polkadot-events');

    // Frequency should receive the downward message
    await frequency.chain.newBlock();
    await checkSystemEvents(frequency).toMatchSnapshot('frequency-receive-events');
  });

  it('frequency send upward messages to Polkadot', async () => {
    await connectVertical(polkadot.chain, frequency.chain);

    const { alice } = testingPairs();

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e10 } }]],
      },
      ForeignAssets: {
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
              balance: 10e10,
              status: { Liquid: null },
              reason: { Consumer: null },
              extra: null,
            },
          ],
        ],
      },
    });

    await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot();
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot();
    await check(
      frequency.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: 'Here',
        },
        alice.address
      )
    ).toMatchSnapshot();

    // await frequency.api.tx.polkadotXcm
    //   .transfer(
    //     {
    //       Token: 'DOT',
    //     },
    //     10e10,
    //     {
    //       V1: {
    //         parents: 1,
    //         interior: {
    //           X1: {
    //             AccountId32: {
    //               network: 'Any',
    //               id: alice.addressRaw,
    //             },
    //           },
    //         },
    //       },
    //     },
    //     {
    //       Unlimited: null,
    //     },
    //   )
    //   .signAndSend(alice)

    // await frequency.chain.newBlock()
    // await checkSystemEvents(frequency).toMatchSnapshot()
    // await check(frequency.api.query.tokens.accounts(alice.address, { token: 'DOT' })).toMatchSnapshot()

    // await polkadot.chain.newBlock()

    // await check(polkadot.api.query.system.account(alice.address)).toMatchSnapshot()
    // await checkSystemEvents(polkadot).toMatchSnapshot()
  });
}, 240000);
