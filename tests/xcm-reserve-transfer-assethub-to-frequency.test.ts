import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

import networks, { type Network } from './networks.js';

describe('XCM limited reserve transfer from AssetHub to Frequency', async () => {
  let frequency: Network;
  let assetHub: Network;

  beforeEach(async () => {
    frequency = await networks.frequency();
    assetHub = await networks.assetHub();
    console.log('assetHub.url', JSON.stringify(assetHub.url, null, 2));

    frequency.chain.setHead(frequency.chain.head);
    assetHub.chain.setHead(assetHub.chain.head);

    const blockNumberFrequency = (await frequency.api.rpc.chain.getHeader()).number.toNumber();
    frequency.dev.setHead(blockNumberFrequency);

    const blockNumberAssetHub = (await assetHub.api.rpc.chain.getHeader()).number.toNumber();
    assetHub.dev.setHead(blockNumberAssetHub);

    // return async () => {
    //   await frequency.teardown();
    //   await assetHub.teardown();
    // };
  });

  afterEach(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });

  it('AssetHub send DOT to Frequency', async () => {
    await connectParachains([assetHub.chain, frequency.chain], false);

    const { alice, bob, charlie } = testingPairs();

    await assetHub.dev.setStorage({
      System: {
        Account: [
          [[alice.address], { providers: 1, data: { free: 1000 * 1e12 }, nonce: 1 }], // Give alice balance
          [[charlie.address], { providers: 1, data: { free: 1000 * 1e12 }, nonce: 1 }],
        ],
      },
    });

    const balanceAssetHub = await assetHub.api.query.system.account(charlie.address);
    await check(balanceAssetHub).toMatchSnapshot();

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { providers: 1, data: { free: 10 * 1e10 } }]],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            { supply: 1000 * 1e10, owner: alice.address, isSufficient: true },
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
              balance: 12e10,
              status: { Liquid: null },
              reason: { Consumer: null },
              extra: null,
            },
          ],
        ],
      },
    });

    await assetHub.chain.newBlock();

    await check(
      frequency.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: 'Here',
        },
        alice.address
      )
    ).toMatchSnapshot();

    await checkSystemEvents(frequency).toMatchSnapshot(
      'initial-events-force-subscribe-version-notify'
    );

    let assetHubTx = await assetHub.api.tx.polkadotXcm.limitedReserveTransferAssets(
      {
        V3: {
          parents: 1,
          interior: { X1: { Parachain: 2091 } },
        },
      },
      {
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
      },
      {
        V3: [
          {
            id: {
              Concrete: {
                parents: 1,
                interior: 'Here',
              },
            },
            fun: { Fungible: 50 * 1e10 },
          },
        ],
      },
      0,
      'Unlimited'
    );

    try {
      await new Promise(async (resolve, reject) => {
        const unsub = await assetHubTx.signAndSend(
          alice,
          async ({ status, events, dispatchError }) => {
            console.log(`Transaction status: ${status.type}`);

            if (status.isInvalid) {
              console.log('❌ Transaction is invalid');
              unsub();
              reject(new Error('Transaction is invalid'));
              return;
            }

            if (status.isDropped) {
              console.log('❌ Transaction is dropped');
              unsub();
              reject(new Error('Transaction is dropped'));
              return;
            }

            if (status.isReady) {
              console.log('✅ Transaction is ready in pool');
              await assetHub.chain.newBlock();
              // Now create a block to process the transaction
            }

            if (status.isInBlock) {
              console.log('✅ Transaction is in block');

              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = assetHub.api.registry.findMetaError(dispatchError.asModule);
                  console.log('❌ Dispatch error:', `${decoded.section}.${decoded.name}`);
                } else {
                  console.log('❌ Dispatch error:', dispatchError.toString());
                }
                unsub();
                reject(new Error(`Dispatch error: ${dispatchError.toString()}`));
                return;
              }

              console.log('✅ Transaction successful, unsubscribing...');
              unsub();
              resolve(true);
            }
          }
        );
      });
    } catch (error) {
      console.log('error', error);
    }

    await checkHrmp(assetHub)
      .redact({ redactKeys: /setTopic/ })
      .toMatchSnapshot('outbound-hrmp-messages');
    await checkSystemEvents(assetHub).toMatchSnapshot('assethhub-initial-events');

    await frequency.chain.newBlock();
    await checkSystemEvents(frequency, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot(
      'AssetHub chain xcm events'
    );

    // Verify XCM success/failure
    const events = await frequency.api.query.system.events();
    console.log('Frequency events:', events.toHuman());
    const xcmResults = events.filter(
      ({ event }) => event.section === 'xcmpQueue' && ['Success', 'Fail'].includes(event.method)
    );
    console.log(
      'XCM Results:',
      xcmResults.map(e => `${e.event.method}: ${e.event.data}`)
    );

    // await check(assetHub.api.query.foreignAssets.account(  {
    //   parents: 1,
    //   interior: "Here",
    // }, bob.address)).toMatchSnapshot('frequency-final-balance')
  }, 240000);
});
