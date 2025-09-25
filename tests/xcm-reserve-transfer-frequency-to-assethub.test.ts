import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';
import { getSiblingSovereignAccount, getAccountBalance } from './util.js';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);
import networks, { type Network } from './networks.js';

// npm run test xcm-reserve-transfer-frequency-to-assethub.test.ts
describe('XCM Reserve Transfer from Frequency to AssetHub', async () => {
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

  it('transfers assets from frequency to assethub', async () => {
    // Connect frequency and assetHub with HRMP
    await connectParachains([frequency.chain, assetHub.chain], false);

    const { alice, bob } = testingPairs();

    const DOT_UNIT = 10_000_000_000n; // 1 DOT = 10^10 smallest units
    const FREQUENCY_UNIT = 100_000_000n; // 1 Frequency = 10^8 smallest units

    const FREQUENCY_PARA_ID = 2091;
    const ASSETHUB_PARA_ID = 1000;

    await setStorage(frequency.chain, {
      // Seed Alice account on Frequency
      System: {
        Account: [[[alice.address], { data: { free: 1000n * FREQUENCY_UNIT } }]],
      },
      // Create DOT asset on Frequency with Alice as owner
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            { supply: 1000n * DOT_UNIT, owner: alice.address, isSufficient: true },
          ],
        ],
        // Give Alice DOT balance on Frequency
        Account: [
          [
            [{ parents: 1, interior: 'Here' }, alice.address],
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
        // SafeXcmVersion is the version of the XCM protocol that we support
        // I do not think for test we need it but it should be 5
        SafeXcmVersion: 3,
        // To be able to send XCM messages to AssetHub we need to know the supported versions of AssetHub otherwise
        // for testing it will fail. In production, will queue the message and wait for the supported version to be updated.
        SupportedVersion: [
          [
            [
              5,
              {
                V5: { parents: 1, interior: { X1: [{ Parachain: ASSETHUB_PARA_ID }] } },
              },
            ],
            4,
          ],
        ],
      },
    });

    const siblingSovereignAccount = await getSiblingSovereignAccount(FREQUENCY_PARA_ID);

    await setStorage(assetHub.chain, {
      System: {
        // Seed Alice and the Sibling Sovereign account on AssetHub
        Account: [
          [[alice.address], { data: { free: 1000n * DOT_UNIT } }],
          // Sovereign account on AssetHub we need to seed this otherwise
          // will fail when sending a reserve transfer to AssetHub because it will not
          // find the sovereign account which is updated when sending money out from AssetHub.
          [[siblingSovereignAccount], { data: { free: 1000n * DOT_UNIT } }],
        ],
        // Account: [[[alice.address], { data: { free: 1000 * 1e12 }, providers: 1 }]],
      },
    });

    // I do not think we need these here anymore
    await frequency.chain.newBlock();
    // await assetHub.chain.newBlock();

    // await checkSystemEvents(frequency).toMatchSnapshot('frequency-initial-events');
    // await checkSystemEvents(assetHub).toMatchSnapshot('assetHub-initial-events');
    ///////////////////////

    // Step 1: Define the destination (AssetHub parachain)
    const destination = {
      V3: { parents: 1, interior: { X1: { Parachain: ASSETHUB_PARA_ID } } },
    };

    // Step 2: Define the beneficiary (Bob on AssetHub)
    const beneficiary = {
      V3: {
        parents: 0,
        interior: { X1: { AccountId32: { network: null, id: bob.addressRaw } } },
      },
    };

    // Step 3: Define the asset to transfer (DOT)
    const transferAsset = {
      V3: [
        { id: { Concrete: { parents: 1, interior: 'Here' } }, fun: { Fungible: 8n * DOT_UNIT } },
      ],
    };

    // Send a limited reserve transfer from Frequency to AssetHub
    const tx = frequency.api.tx.polkadotXcm.limitedReserveTransferAssets(
      destination,
      beneficiary,
      transferAsset,
      0, // Asset index used to pay fee
      'Unlimited' // Weight limit of the transfer
    );

    await sendTransaction(tx.signAsync(alice));

    await frequency.chain.newBlock();
    // Check HRMP messages from Frequency
    await checkHrmp(frequency).toMatchSnapshot('frequency-outbound-hrmp-messages');
    // Check system events from Frequency
    await checkSystemEvents(frequency).toMatchSnapshot('frequency-events-after-sending-xcm-events');

    // TODO check final balance of DOT
    // Check balance of Alice on Frequency
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot();

    await assetHub.chain.newBlock();

    // Check system events from AssetHub
    await checkSystemEvents(assetHub, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot(
      'assethub-receive-chain-xcm events'
    );

    // Check final balances
    const aliceFrequencyBalance = await getAccountBalance(frequency.api, alice.address);
    const aliceAssetHubBalance = await getAccountBalance(assetHub.api, alice.address);
    const bobAssetHubBalance = await getAccountBalance(assetHub.api, bob.address);

    console.log('Alice Frequency balance:', aliceFrequencyBalance.toString());
    console.log('Alice AssetHub balance:', aliceAssetHubBalance.toString());
    console.log('Bob AssetHub balance:', bobAssetHubBalance.toString());

    // Check balance of Alice on AssetHub
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot();
    // Check balance of Alice on AssetHub
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot();
  });
}, 240000);
