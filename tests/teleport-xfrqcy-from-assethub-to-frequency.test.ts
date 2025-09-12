import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { setupContext, testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

import networks, { type Network } from './networks.js';
import { getSiblingSovereignAccount } from './util.js';

describe('Teleport DOT from AssetHub to Frequency with DOT fee', () => {
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

  afterEach(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });

  it('Teleport DOT from AssetHub to Frequency with DOT fee', async () => {
    await connectParachains([assetHub.chain, frequency.chain], false);

    const { alice, bob } = testingPairs();

    // const paraId = 2091;
    // const siblingSovereignAccount = await getSiblingSovereignAccount(paraId);
    // console.log('siblingSovereignAccount', siblingSovereignAccount);
    // const sib = '5Eg2fnsixbRfQGTeUNds5WBdpL3gvhUzF9yPCnaKX43Pc7Dk';

    // Setup AssetHub with DOT balance for alice
    await setStorage(assetHub.chain, {
      System: {
        Account: [
          [[alice.address], { data: { free: 1000 * 1e12 }, providers: 1 }],
          //   [[sib], { data: { free: 1000 * 1e12 }, providers: 1 }],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: { X1: [{ Parachain: 2091 }] } }],
            { supply: 1000 * 1e12, owner: alice.address, isSufficient: true },
          ],
        ],
        Account: [
          [
            [
              {
                parents: 1,
                interior: { X1: [{ Parachain: 2091 }] },
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
      PolkadotXcm: {
        SafeXcmVersion: 5,
        SupportedVersion: [
          [
            [
              5,
              {
                V5: { parents: 1, interior: { X1: [{ Parachain: 2091 }] } },
              },
            ],
            5,
          ],
        ],
      },
    });

    await setStorage(frequency.chain, {
      System: {
        Account: [[[alice.address], { providers: 1, data: { free: 1000 * 1e12 } }]],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
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
      PolkadotXcm: {
        SafeXcmVersion: 5,
        SupportedVersion: [
          [
            [
              5,
              {
                V5: { parents: 1, interior: { X1: [{ Parachain: 1000 }] } },
              },
            ],
            5,
          ],
        ],
      },
    });

    // Check initial balances
    // const aliceAssetHubBalanceBefore = await assetHub.api.query.system.account(alice.address);
    // const aliceFrequencyBalanceBefore = await frequency.api.query.system.account(alice.address);
    // const bobFrequencyBalanceBefore = await frequency.api.query.system.account(bob.address);

    // console.log('Alice AssetHub balance before:', aliceAssetHubBalanceBefore.toHuman());
    // console.log('Alice Frequency balance before:', aliceFrequencyBalanceBefore.toHuman());
    // console.log('Bob Frequency balance before:', bobFrequencyBalanceBefore.toHuman());

    const xcm = {
      V5: [
        {
          WithdrawAsset: [
            {
              id: { parents: 1, interior: 'here' },
              fun: { Fungible: 100 * 1e12 },
            },
            {
              id: { parents: 1, interior: { X1: [{ Parachain: 2091 }] } },
              fun: { Fungible: 10 * 1e12 },
            },
          ],
        },
        {
          PayFees: {
            asset: {
              id: { parents: 1, interior: 'here' },
              fun: { Fungible: 3 * 1e12 },
            },
          },
        },
        {
          InitiateTransfer: {
            destination: {
              parents: 1,
              interior: { X1: [{ Parachain: 2091 }] },
            },
            remoteFees: {
              ReserveDeposit: {
                Definite: [
                  {
                    id: { parents: 1, interior: 'here' },
                    fun: { Fungible: 9 * 1e10 },
                  },
                ],
              },
            },
            preserveOrigin: false,
            assets: [
              {
                Teleport: {
                  Definite: [
                    {
                      id: { parents: 1, interior: { X1: [{ Parachain: 2091 }] } },
                      fun: { Fungible: 10 * 1e12 },
                    },
                  ],
                },
              },
            ],
            remoteXcm: [
              //   {
              //     BuyExecution: {
              //       fees: {
              //         id: { parents: 1, interior: 'Here' },
              //         fun: { Fungible: 11 * 1e12 },
              //       },
              //       weightLimit: 'Unlimited',
              //     },
              //   },
              {
                DepositAsset: {
                  assets: { Wild: { AllCounted: 2 } },
                  beneficiary: {
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
              },
            ],
          },
        },
        {
          RefundSurplus: null,
        },
      ],
    };

    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-frequency-check-system-account'
    );
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-assethub-check-system-account'
    );

    await check(
      assetHub.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: { X1: [{ Parachain: 2091 }] },
        },
        alice.address
      )
    ).toMatchSnapshot('assethub-check-foreign-assets-account');

    // Create a block to ensure proper state
    await assetHub.chain.newBlock();

    const tx = await assetHub.api.tx.polkadotXcm.execute(xcm, {
      refTime: 8000000000,
      proofSize: 200000,
    });

    console.log('tx', tx.toHex());

    // Send transaction and wait for it to be included
    // await new Promise(async (resolve, reject) => {
    //   const unsub = await tx.signAndSend(alice, async ({ status, events, dispatchError }) => {
    //     console.log(`Transaction status: ${status.type}`);

    //     if (status.isInvalid) {
    //       console.log('❌ Transaction is invalid');
    //       unsub();
    //       reject(new Error('Transaction is invalid'));
    //       return;
    //     }

    //     if (status.isDropped) {
    //       console.log('❌ Transaction is dropped');
    //       unsub();
    //       reject(new Error('Transaction is dropped'));
    //       return;
    //     }

    //     if (status.isReady) {
    //       console.log('✅ Transaction is ready in pool');
    //       // Create block to process the transaction
    //       await assetHub.chain.newBlock();
    //       console.log('✅ Block created to process transaction');
    //     }

    //     if (status.isInBlock) {
    //       console.log('✅ Transaction is in block');

    //       if (dispatchError) {
    //         if (dispatchError.isModule) {
    //           const decoded = assetHub.api.registry.findMetaError(dispatchError.asModule);
    //           console.log('❌ Dispatch error:', `${decoded.section}.${decoded.name}`);
    //         } else {
    //           console.log('❌ Dispatch error:', dispatchError.toString());
    //         }
    //         unsub();
    //         reject(new Error(`Dispatch error: ${dispatchError.toString()}`));
    //         return;
    //       }

    //       console.log('✅ Transaction successful, unsubscribing...');
    //       unsub();
    //       resolve(true);
    //     }
    //   });
    // });

    await sendTransaction(tx.signAsync(alice));

    await assetHub.chain.newBlock();

    // Check HRMP messages from AssetHub
    await checkHrmp(assetHub)
      .redact({ redactKeys: /setTopic/ })
      .toMatchSnapshot('assethub-outbound-hrmp-messages');

    await checkSystemEvents(assetHub).toMatchSnapshot('assethub-events-after-teleport');

    //  Process the message on Frequency
    await frequency.chain.newBlock();

    await checkSystemEvents(frequency, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot(
      'frequency-xcm-events-after-teleport'
    );

    // Check final balances

    // Verify balances changed as expected
  });
});
