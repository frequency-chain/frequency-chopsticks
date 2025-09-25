import { describe, it, expect } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectParachains } from '@acala-network/chopsticks';
import { KeyringPair } from '@polkadot/keyring/types';
import { checkingAccount, getAccountBalance } from './util.js';

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);

import networks, { type Network } from './networks.js';

describe('Teleport DOT from AssetHub to Frequency with DOT fee', () => {
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

  /**
   * Tests teleporting DOT from AssetHub to Frequency with DOT fee payment.
   * This test verifies the XCM teleport functionality between parachains.
   * Alice from AssetHub sends Frequency to Bob on Frequency.
   * Note that bob started with 0 Frequency.
   *
   * Expected behavior:
   * - Alice teleports DOT from AssetHub to Frequency
   * - DOT fee is paid for the teleport operation
   * - Bob receives the teleported Native on Frequency
   */
  it('Teleport DOT from AssetHub to Frequency with DOT fee', async () => {
    await connectParachains([assetHub.chain, frequency.chain], false);

    const { alice, bob }: { alice: KeyringPair; bob: KeyringPair } = testingPairs();

    // Token unit definitions (smallest units per token)
    const DOT_UNIT = 10_000_000_000n; // 1 DOT = 10^10 smallest units
    const FREQUENCY_UNIT = 100_000_000n; // 1 Frequency = 10^8 smallest units

    const FREQUENCY_PARA_ID = 2091;
    const ASSETHUB_PARA_ID = 1000;


    // Setup AssetHub with DOT balance for alice
    await setStorage(assetHub.chain, {
      System: {
        Account: [
          [
            [alice.address],
            {
              data: { free: 100n * DOT_UNIT },
              providers: 1,
            },
          ],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } }],
            {
              supply: 10000n * FREQUENCY_UNIT,
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
                interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] },
              },
              alice.address,
            ],
            {
              balance: 100n * FREQUENCY_UNIT,
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
                V5: { parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } },
              },
            ],
            5,
          ],
        ],
      },
    });

    // Setup Frequency with native balance for alice
    await setStorage(frequency.chain, {
      System: {
        Account: [
          [
            [alice.address],
            {
              providers: 1,
              data: { free: 1000n * FREQUENCY_UNIT },
            },
          ],
          [[checkingAccount()], { data: { free: 10000n * FREQUENCY_UNIT }, providers: 1 }],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'Here' }],
            {
              supply: 100n * DOT_UNIT * 10n,
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
              balance: 100n * DOT_UNIT,
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
                V5: { parents: 1, interior: { X1: [{ Parachain: ASSETHUB_PARA_ID }] } },
              },
            ],
            5,
          ],
        ],
      },
    });

    const bobFrequencyBalance = (
      await frequency.api.query.system.account(bob.address)
    ).data.free.toBigInt();
    assert(bobFrequencyBalance === 0n, 'Bob should have 0 Frequency');

    // assert(bobsDotBalanceOnFrequency === 0n, 'Bob should have 0 DOT on Frequency');

    // Build the complete XCM message
    const xcm = {
      V5: [
        {
          WithdrawAsset: [
            { id: { parents: 1, interior: 'here' }, fun: { Fungible: 10n * DOT_UNIT } },
            {
              id: { parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } },
              fun: { Fungible: 10n * FREQUENCY_UNIT },
            },
          ],
        },
        {
          PayFees: {
            asset: { id: { parents: 1, interior: 'here' }, fun: { Fungible: 2n * DOT_UNIT } },
          },
        },
        {
          InitiateTransfer: {
            destination: {
              parents: 1,
              interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] },
            },
            remoteFees: {
              ReserveDeposit: {
                Definite: [
                  { id: { parents: 1, interior: 'here' }, fun: { Fungible: 3n * DOT_UNIT } },
                ],
              },
            },
            preserveOrigin: false,
            assets: [
              {
                Teleport: {
                  Definite: [
                    {
                      id: { parents: 1, interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] } },
                      fun: { Fungible: 10n * FREQUENCY_UNIT },
                    },
                  ],
                },
              },
            ],
            remoteXcm: [
              // The DOT is refunded to Bob along with the deposit of Frequency alice sent to Bob.
              // We can adjust this to return the DOT fee to alice on Frequency
              {
                RefundSurplus: null,
              },
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
        {
          DepositAsset: {
            assets: { Wild: { AllCounted: 1 } },
            beneficiary: {
              parents: 0,
              interior: {
                X1: [
                  {
                    AccountId32: {
                      network: null,
                      id: alice.addressRaw,
                    },
                  },
                ],
              },
            },
          },
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
          interior: { X1: [{ Parachain: FREQUENCY_PARA_ID }] },
        },
        alice.address
      )
    ).toMatchSnapshot('assethub-check-alice-frequency-foreign-assets-account');

    // Create a block to ensure proper state
    await assetHub.chain.newBlock();

    const tx = await assetHub.api.tx.polkadotXcm.execute(xcm, {
      refTime: 8000000000,
      proofSize: 200000,
    });

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

    // Check that bob received the teleported Frequency
    const bobFinalBalance = await getAccountBalance(frequency.api, bob.address);
    const expectedBobBalance = 10n * FREQUENCY_UNIT;

    assert(
      bobFinalBalance === expectedBobBalance,
      `Bob should have ${expectedBobBalance} Frequency, but has ${bobFinalBalance}`
    );
  });
}, 240000);
