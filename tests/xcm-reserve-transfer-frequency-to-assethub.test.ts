import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';
import { getSiblingSovereignAccount } from './util.js';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);
import networks, { type Network } from './networks.js';

describe('XCM Reserve Transfer from Frequency to AssetHub', () => {
  let frequency: Network;
  let assetHub: Network;

  beforeEach(async () => {
    frequency = await networks.frequency();
    assetHub = await networks.assetHub();
  });

  afterEach(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });

  it('transfers assets from frequency to assethub', async () => {
    await connectParachains([frequency.chain, assetHub.chain], false);

    const { alice, bob } = testingPairs();

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { data: { free: 1000 * 1e12 } }]],
      },
      ForeignAssets: {
        Asset: [[[{ parents: 1, interior: 'Here' }], { supply: 1000e10, owner: alice.address, isSufficient: true }]],
        Account: [
          [
            [
              { parents: 1, interior: 'Here' },
              alice.address,
            ],
            { balance: 100 * 1e12, status: { Liquid: null }, reason: { Consumer: null }, extra: null },
          ],
        ],
      },
      PolkadotXcm: {
        SafeXcmVersion: 3,
        SupportedVersion: [
          [
            [
              5,
              {
                V5: { parents: 1, interior: { X1: [{ Parachain: 1000 }] } },
              },
            ],
            4,
          ],
        ],
      },
    });

    const paraId = 2091;
    const siblingSovereignAccount = await getSiblingSovereignAccount(paraId);
    console.log('siblingSovereignAccount', siblingSovereignAccount);
    const sib = "5Eg2fnsixbRfQGTeUNds5WBdpL3gvhUzF9yPCnaKX43Pc7Dk";
    // const souvereignAccount = await assetHub.api.;
    // console.log('souvereignAccount', souvereignAccount.toHuman());

    await setStorage(assetHub.chain, {
      System: {
        // seed sovereign account
        Account: [[[alice.address], { data: { free: 1000 * 1e12 } }], [[sib], { data: { free: 1000 * 1e12 } }]],
        // Account: [[[alice.address], { data: { free: 1000 * 1e12 }, providers: 1 }]],
      },
    });
    
    await frequency.chain.newBlock();
    await assetHub.chain.newBlock();

    await checkSystemEvents(frequency).toMatchSnapshot('frequency-initial-events');
    await checkSystemEvents(assetHub).toMatchSnapshot('assetHub-initial-events');

    const tx = frequency.api.tx.polkadotXcm.limitedReserveTransferAssets(
      {
        V3: { parents: 1, interior: { X1: { Parachain: 1000 } } },
      },
      {
        V3: { parents: 0, interior: { X1: { AccountId32: { network: null, id: bob.addressRaw } } } },
      },
      {
        V3: [
          { id: { Concrete: { parents: 1, interior: 'Here' } }, fun: { Fungible: 8 * 1e12 } },
        ],
      },
      0,
      'Unlimited'
    );

    await sendTransaction(tx.signAsync(alice));
    await frequency.chain.newBlock();
    await checkHrmp(frequency).toMatchSnapshot('frequency-inbound-hrmp-messages');
    await checkSystemEvents(frequency).toMatchSnapshot('frequency-after-sending-xcm-events');
    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot();

    await assetHub.chain.newBlock();

    await checkSystemEvents(assetHub, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot('assethub-receive-chain-xcm events');
    // await checkHrmp(assetHub).toMatchSnapshot('assetHubinbound-hrmp-messages');

    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot();
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot();
  });
});