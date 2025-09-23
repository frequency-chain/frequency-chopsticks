import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

import networks, { type Network } from './networks.js';

// npm run test xcm-reserve-transfer-assethub-to-frequency.test.ts
describe('XCM limited reserve transfer from AssetHub to Frequency', async () => {
  let frequency: Network;
  let assetHub: Network;

  beforeEach(async () => {
    frequency = await networks.frequency();
    assetHub = await networks.assetHub();

    frequency.chain.setHead(frequency.chain.head);
    assetHub.chain.setHead(assetHub.chain.head);

    const blockNumberFrequency = (await frequency.api.rpc.chain.getHeader()).number.toNumber();
    frequency.dev.setHead(blockNumberFrequency);

    const blockNumberAssetHub = (await assetHub.api.rpc.chain.getHeader()).number.toNumber();
    assetHub.dev.setHead(blockNumberAssetHub);
  });

  afterAll(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });

  it('From AssetHub send DOT to Frequency', async () => {
    await connectParachains([assetHub.chain, frequency.chain], false);

    const { alice, bob, charlie }: { alice: any; bob: any; charlie: any } = testingPairs();

    // Seed Alice and Bob account on AssetHub
    await assetHub.dev.setStorage({
      System: {
        Account: [
          [[alice.address], { providers: 1, data: { free: 1000 * 1e12 }, nonce: 1 }], // Give alice balance
          [[charlie.address], { providers: 1, data: { free: 1000 * 1e12 }, nonce: 1 }],
        ],
      },
    });

    // Check balance of charlie on AssetHub
    // Not needed anymore
    const balanceAssetHub = await assetHub.api.query.system.account(charlie.address);
    await check(balanceAssetHub).toMatchSnapshot();

    await setStorage(frequency.chain, {
      // Seed Alice account on Frequency
      System: {
        Account: [[[alice.address], { providers: 1, data: { free: 10 * 1e10 } }]],
      },
      // Create DOT asset on Frequency with Alice as owner
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            { supply: 1000 * 1e10, owner: alice.address, isSufficient: true },
          ],
        ],
        // Give Alice DOT balance on Frequency
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

    // Not needed anymore this was me checking that the asset was created on Frequency
    await check(
      frequency.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: 'Here',
        },
        alice.address
      )
    ).toMatchSnapshot('assethub-check-foreign-assets-account');

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

    // Not needed anymore because we are checking the system events
    // This was used to verify the XCM success/failure
    // Verify XCM success/failure
    // const events = await frequency.api.query.system.events();
    // console.log('Frequency events:', events.toHuman());
    // const xcmResults = events.filter(
    //   ({ event }) => event.section === 'xcmpQueue' && ['Success', 'Fail'].includes(event.method)
    // );
    // console.log(
    //   'XCM Results:',
    //   xcmResults.map(e => `${e.event.method}: ${e.event.data}`)
    // );

    // TODO: Check final balances

    // await check(assetHub.api.query.foreignAssets.account(  {
    //   parents: 1,
    //   interior: "Here",
    // }, bob.address)).toMatchSnapshot('frequency-final-balance')
  }, 240000);
});
