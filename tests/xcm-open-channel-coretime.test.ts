import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setStorage } from '@acala-network/chopsticks-core';
import { withExpect } from '@acala-network/chopsticks-testing';
import { testingPairs, sendTransaction } from '@acala-network/chopsticks-testing';
import { connectVertical } from '@acala-network/chopsticks';
import { getAccountBalance, getChildSovereignAccount } from './util.js';

const { checkSystemEvents, checkUmp } = withExpect(expect);

import networks, { type Network } from './networks.js';

describe('XCM Channel Opening with Coretime', async () => {
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

  it('opens HRMP channel with Coretime via governance XCM', async () => {
    await connectVertical(polkadot.chain, frequency.chain);

    const { alice } = testingPairs();

    const FREQUENCY_UNIT = 100_000_000n; 
    const DOT_UNIT = 10_000_000_000n; 
    const FREQUENCY_PARA_ID = 4000; 

    const EXECUTION_FEE = 50000n * FREQUENCY_UNIT;

    const DOT_FOREIGN_ASSET_SUPPLY = 1000n * DOT_UNIT;

    const childSovereignAccount = await getChildSovereignAccount(FREQUENCY_PARA_ID);

    await setStorage(frequency.chain, {
      Sudo: {
        Key: alice.address,
      },
      System: {
        Account: [
          [
            [alice.address],
            {
              providers: 1,
              data: { free: 10000n * FREQUENCY_UNIT }, 
            },
          ],
        ],
      },
      ForeignAssets: {
        Asset: [
          [
            [{ parents: 1, interior: 'here' }], 
            {
              supply: DOT_FOREIGN_ASSET_SUPPLY,
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
              balance: DOT_FOREIGN_ASSET_SUPPLY,
              status: { Liquid: null },
              reason: { Consumer: null },
              extra: null,
            },
          ],
        ],
      },
      PolkadotXcm: {
        // SafeXcmVersion is the version of the XCM protocol that we support
        SafeXcmVersion: 5,
        // To be able to send XCM messages to the relay chain, we need to configure supported versions
        SupportedVersion: [
          [
            [
              5,
              {
                V5: { parents: 1, interior: 'here' }, // Relay chain location
              },
            ],
            5,
          ],
        ],
      },
    });

    await setStorage(polkadot.chain, {
      System: {
        Account: [
          [
            [alice.address],
            { data: { free: 1000n * DOT_UNIT } }, 
          ],
          [
            [childSovereignAccount],
            { data: { free: 1000n * DOT_UNIT }, providers: 1 }, 
          ],
        ],
      },
    });

    await frequency.chain.newBlock();
    await polkadot.chain.newBlock();

    const initialBalance = await getAccountBalance(frequency.api, alice.address);
    expect(initialBalance).toBeGreaterThanOrEqual(10000n * FREQUENCY_UNIT);

    const destination = {
      V3: {
        parents: 1,
        interior: 'here',
      },
    };

    const message = {
      V3: [
        {
          WithdrawAsset: [
            {
              id: {
                Concrete: {
                  parents: 0,
                  interior: 'here',
                },
              },
              fun: {
                Fungible: EXECUTION_FEE,
              },
            },
          ],
        },
        {
          BuyExecution: {
            fees: {
              id: {
                Concrete: {
                  parents: 0,
                  interior: 'here',
                },
              },
              fun: {
                Fungible: EXECUTION_FEE,
              },
            },
            weightLimit: 'Unlimited',
          },
        },
        {
          Transact: {
            origin_kind: 'native',
            require_weight_at_most: {
              ref_time: 12000000000,
              proof_size: 73603,
            },
            call: {
              encoded: '0x3c0aed030000', // HRMP channel opening call to Coretime update later
            },
          },
        },
        {
          RefundSurplus: {},
        },
        {
          DepositAsset: {
            assets: {
              Wild: 'All',
            },
            beneficiary: {
              parents: 0,
              interior: {
                X1: {
                  Parachain: FREQUENCY_PARA_ID,
                },
              },
            },
          },
        },
      ],
    };

    const tx = await frequency.api.tx.polkadotXcm.send(destination, message);

    // Since alice is the sudo key, we can call send directly
    await sendTransaction(tx.signAsync(alice));

    await frequency.chain.newBlock();

    await checkSystemEvents(frequency).toMatchSnapshot('frequency-events');
    await checkUmp(frequency).toMatchSnapshot('frequency-ump-events');

    await polkadot.chain.newBlock();

    await checkSystemEvents(polkadot).toMatchSnapshot('polkadot-events');

    const CORETIME_PARA_ID = 1005;
    const channel = await polkadot.api.query.hrmp.hrmpChannels([FREQUENCY_PARA_ID, CORETIME_PARA_ID]);
    expect(channel).toBeDefined();

    const finalBalance = await getAccountBalance(frequency.api, alice.address);
    expect(finalBalance).toBeLessThan(initialBalance);
  });
}, 240000);
