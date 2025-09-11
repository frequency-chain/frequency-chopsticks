import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import networks, { type Network } from './networks';
import { describe, it, expect } from 'vitest';
import { withExpect } from '@acala-network/chopsticks-testing';
import { setStorage } from '@acala-network/chopsticks';
import { getSiblingSovereignAccount } from './util';

import { connectParachains } from '@acala-network/chopsticks';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

describe('Teleport XFRQCY to AssetHub with DOT fee', () => {
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

  it('Teleport XFRQCY to AssetHub with DOT fee', async () => {
    await connectParachains([frequency.chain, assetHub.chain], false);
    const { alice, bob } = testingPairs();

    const paraId = 2091;
    const siblingSovereignAccount = await getSiblingSovereignAccount(paraId);
    const sib = '5Eg2fnsixbRfQGTeUNds5WBdpL3gvhUzF9yPCnaKX43Pc7Dk';

    await setStorage(assetHub.chain, {
      System: {
        Account: [
          [[alice.address], { data: { free: 1000 * 1e12 } }],
          [[sib], { data: { free: 1000 * 1e12 } }],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: { X1: [{ Parachain: 2091 }] } }],
            { supply: 1000 * 1e12, owner: alice.address, isSufficient: true },
          ],
        ],
        // Account: [
        //   [
        //     [
        //       {
        //         parents: 1,
        //         interior: { X1: [{ Parachain: 2091 }] },
        //       },
        //       alice.address,
        //     ],
        //     {
        //       balance: 1000 * 1e12,
        //       status: { Liquid: null },
        //       reason: { Consumer: null },
        //       extra: null,
        //     },
        //   ],
        // ],
      },
    //   PolkadotXcm: {
    //     SafeXcmVersion: 3,
    //     SupportedVersion: [
    //       [
    //         [
    //           5,
    //           {
    //             V5: { parents: 1, interior: { X1: [{ Parachain: 2091 }] } },
    //           },
    //         ],
    //         4,
    //       ],
    //     ],
    //   },
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
        SafeXcmVersion: 4,
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

    await check(frequency.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-frequency-check-system-account'
    );
    await check(assetHub.api.query.system.account(alice.address)).toMatchSnapshot(
      'initial-assethub-check-system-account'
    );

    await check(
      frequency.api.query.foreignAssets.account(
        {
          parents: 1,
          interior: 'Here',
        },
        alice.address
      )
    ).toMatchSnapshot('frequency-check-foreign-assets-account');

    const xcm = {
      V5: [
        {
          WithdrawAsset: [
            {
              id: { parents: 0, interior: 'here' },
              fun: { Fungible: 100 * 1e12 },
            },
            {
              id: { parents: 1, interior: 'here' },
              fun: { Fungible: 10 * 1e12 },
            },
          ],
        },
        {
          InitiateTransfer: {
            destination: {
              parents: 1,
              interior: { X1: [{ Parachain: 1000 }] },
            },
            remoteFees: {
              ReserveWithdraw: {
                Definite: [
                  {
                    id: { parents: 1, interior: 'here' },
                    fun: { Fungible: 9 * 1e12 },
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
                      id: { parents: 0, interior: 'here' },
                      fun: { Fungible: 100 * 1e12 },
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
        }
      ],
    };

    // i am not sure why we need to create a block here
    await frequency.chain.newBlock();

    const tx = await frequency.api.tx.polkadotXcm.execute(xcm, {
      refTime: 8000000000,
      proofSize: 200000,
    });

    await sendTransaction(tx.signAsync(alice));

    await frequency.chain.newBlock();

    await checkHrmp(frequency)
      .redact({ redactKeys: /setTopic/ })
      .toMatchSnapshot('frequency-outbound-hrmp-messages');
    
    await checkSystemEvents(frequency).toMatchSnapshot('frequency-events-after-xcm');

    await assetHub.chain.newBlock();

    await checkSystemEvents(assetHub, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot('assethub xcm chain events')

    // check final balance of alice in frequency
    const aliceFrequencyBalance = await frequency.api.query.system.account(alice.address);
    await check(aliceFrequencyBalance).toMatchSnapshot('frequency-final-balance');
    let aliceBalance = parseInt((aliceFrequencyBalance.toHuman() as any).data.free.replace(/,/g, ''));
    assert(aliceBalance < (1000 * 1e12 - 100 * 1e12), "Balance of alice in Frequency is not less than 1000 XFRQCY" );

    // check final balance of alice dot on frequency
    const aliceDotAccount = await frequency.api.query.foreignAssets.account(
      {
        parents: 1,
        interior: 'Here',
      },
      alice.address
    );
    await check(aliceDotAccount).toMatchSnapshot('frequency-final-balance');
    let aliceDotBalance = parseInt((aliceDotAccount.toHuman() as any).balance.replace(/,/g, ''));
    assert(aliceDotBalance < 100 * 1e12, "Balance of alice dot in Frequency is not less than 100 DOT" );
  
    // Check final balances for receiving account
    const bobForeignAssets = await assetHub.api.query.foreignAssets.account(
      {
        parents: 1,
        interior: { X1: [{ Parachain: 2091 }] },
      },
      bob.address
    );
    await check(bobForeignAssets).toMatchSnapshot('assethub-final-balance');
    let balance = parseInt((bobForeignAssets.toHuman() as any).balance.replace(/,/g, ''));
    assert(balance == 100 * 1e12, "Balance of bob in AssetHub is not 100 XFRQCY" );
  });
});
