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
  });

  afterAll(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });

  it('Teleport XFRQCY to AssetHub with DOT fee', async () => {
    await connectParachains([frequency.chain, assetHub.chain], false);
    const { alice, bob } = testingPairs();
    
    const FREQUENCY_PARA_ID: number = 2091;
    const ASSETHUB_PARA_ID: number = 1000;

    const DOT_DOLLAR_UNIT = 10_000_000_000n; // 1 DOT (10 decimals)
    const FREQUENCY_DOLLAR_UNIT = 100_000_000n; // 1 Frequency (8 decimals)

    const FREQUENCY_SUPPLY = 10000n * FREQUENCY_DOLLAR_UNIT;

    const frequencySovereignAccount = await getSiblingSovereignAccount(FREQUENCY_PARA_ID);

    await setStorage(assetHub.chain, {
      System: {
        Account: [
          [[alice.address], { data: { free: 1000n * DOT_DOLLAR_UNIT } }],
          [[frequencySovereignAccount], { data: { free: 1000n * DOT_DOLLAR_UNIT } }],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } }],
            { supply: FREQUENCY_SUPPLY, owner: alice.address, isSufficient: true },
          ],
        ],
      },
    });

    await setStorage(frequency.chain, {
      System: {
        Account: [
          [[alice.address], { providers: 1, data: { free: 1000n * FREQUENCY_DOLLAR_UNIT } }],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            { supply: 1000n * DOT_DOLLAR_UNIT, owner: alice.address, isSufficient: true },
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
              balance: 100n * DOT_DOLLAR_UNIT,
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
                V5: { parents: 1, interior: { X1: [{ Parachain: ASSETHUB_PARA_ID }] } },
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
              fun: { Fungible: 100n * FREQUENCY_DOLLAR_UNIT },
            },
            {
              id: { parents: 1, interior: 'here' },
              fun: { Fungible: 10n * DOT_DOLLAR_UNIT },
            },
          ],
        },
        {
          InitiateTransfer: {
            destination: {
              parents: 1,
              interior: { X1: [{ Parachain: ASSETHUB_PARA_ID }] },
            },
            remoteFees: {
              ReserveWithdraw: {
                Definite: [
                  {
                    id: { parents: 1, interior: 'here' },
                    fun: { Fungible: 3n * DOT_DOLLAR_UNIT },
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
                      fun: { Fungible: 100n * FREQUENCY_DOLLAR_UNIT },
                    },
                  ],
                },
              },
            ],
            remoteXcm: [
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

    await checkSystemEvents(assetHub, 'xcmpQueue', 'dmpQueue', 'messageQueue').toMatchSnapshot(
      'assethub xcm chain events'
    );

    // check final balance of alice in frequency
    const aliceFrequencyBalance = await frequency.api.query.system.account(alice.address);
    await check(aliceFrequencyBalance).toMatchSnapshot('frequency-final-balance');
    let aliceBalance = parseInt(
      (aliceFrequencyBalance.toHuman() as any).data.free.replace(/,/g, '')
    );
    assert(
      aliceBalance < 1000 * 1e12 - 100 * 1e12,
      'Balance of alice in Frequency is not less than 1000 XFRQCY'
    );

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
    assert(
      aliceDotBalance < 100n * DOT_DOLLAR_UNIT,
      'Balance of alice dot in Frequency is not less than 100 DOT'
    );

    // Check final balances for receiving account
    const bobForeignAssets = await assetHub.api.query.foreignAssets.account(
      {
        parents: 1,
        interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] },
      },
      bob.address
    );
    await check(bobForeignAssets).toMatchSnapshot('assethub-final-balance');
    let balance = parseInt((bobForeignAssets.toHuman() as any).balance.replace(/,/g, ''));
    assert(BigInt(balance) == 100n * FREQUENCY_DOLLAR_UNIT, 'Balance of bob in AssetHub is not 100 XFRQCY');
  });
}, 240000);
