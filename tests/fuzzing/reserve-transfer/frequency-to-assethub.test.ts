import { describe, it, expect } from "vitest"; // sovereign account id for Frequency
import { setStorage } from "@acala-network/chopsticks-core";
import { withExpect } from "@acala-network/chopsticks-testing";
import {
  testingPairs,
  sendTransaction,
} from "@acala-network/chopsticks-testing";
import { connectParachains } from "@acala-network/chopsticks";
import fc, { anything } from "fast-check";

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);
import networks, { type Network } from "../../networks.js";

// sovereign account id for Frequency
const SIB = "5Eg2fnsixbRfQGTeUNds5WBdpL3gvhUzF9yPCnaKX43Pc7Dk";
const AssetHubID = 1000;
const FrequencyId = 2091;

describe("XCM Reserve Transfer from Frequency to AssetHub", () => {
  let frequency: Network;
  let assetHub: Network;

  beforeEach(async () => {
    frequency = await networks.frequency();
    assetHub = await networks.assetHub();
    await connectParachains([frequency.chain, assetHub.chain], false);
  });

  afterEach(async () => {
    await frequency.teardown();
    await assetHub.teardown();
  });
  const { alice, bob } = testingPairs();

  // example:
  //   parents: 1 means go up 1 level from the parachain, so, to the relay chain
  //   interior: 'Here' means the asset native to that location i.e. to relay chain, i.e. DOT.
  //   in short: transfer `amount`  DOT (relay-native)
  //   V3: [{ id: { Concrete: { parents: 1, interior: 'Here' } }, fun: { Fungible: 8 * 1e12 } }],
  const transferRelayDOTRelativeToParachain = (amount: number = 8 * 1e12) => {
    return {
      id: { Concrete: { parents: 1, interior: "Here" } },
      fun: { Fungible: amount },
    };
  };
  const accountWithFreeBalance = (
    address: string,
    free: number = 1000 * 1e12,
  ) => {
    return [[address], { data: { free } }];
  };

  // create a storage object for Relay Chain token (generally, DOT) using the provided parameters
  // owner:  the owner of the foreign asset.
  // supply:  how much total of the asset is on this chain
  // tokenHolder: the account to set up with some of this token
  // balance: how much free balance tokenHolder should have.
  const createForeignDOTStorage = (
    owner: string,
    supply: number,
    tokenHolder: string,
    balance: number,
  ) => {
    console.log(
      `Setting up DOT supply of ${supply} owner: ${owner}, with ${tokenHolder} having balance ${balance} `,
    );
    return {
      Asset: [
        [
          [{ parents: 1, interior: "Here" }], // go up one, to relay chain, HERE=native token i.e. DOT
          { supply, owner, isSufficient: true }, //
        ],
      ],
      Account: [
        [
          [{ parents: 1, interior: "Here" }, tokenHolder],
          {
            balance,
            status: { Liquid: null },
            reason: { Consumer: null },
            extra: null,
          },
        ],
      ],
    };
  };

  const SupportedVersion = [
    [
      [
        5,
        {
          V5: { parents: 1, interior: { X1: [{ Parachain: 1000 }] } },
        },
      ],
      4,
    ],
  ];
  const defaultStorage = {
    System: {
      Account: [accountWithFreeBalance(alice.address)],
    },
    ForeignAssets: createForeignDOTStorage(
      alice.address,
      1000e10,
      alice.address,
      100e12,
    ), // this gives Alice some DOT on the Frequency chain.
    PolkadotXcm: {
      SafeXcmVersion: 3,
      SupportedVersion,
    },
  };

  it("transfers assets from frequency to assethub", async () => {
    // set Frequency chain storage
    await setStorage(frequency.chain, defaultStorage);

    await setStorage(assetHub.chain, {
      System: {
        // seed sovereign account
        Account: [
          accountWithFreeBalance(alice.address),
          accountWithFreeBalance(SIB),
        ],
      },
    });

    await frequency.chain.newBlock();
    await assetHub.chain.newBlock();

    await checkSystemEvents(frequency).toMatchSnapshot(
      "frequency-initial-events",
    );
    await checkSystemEvents(assetHub).toMatchSnapshot(
      "assetHub-initial-events",
    );

    // https://paritytech.github.io/polkadot-sdk/master/pallet_xcm/pallet/dispatchables/fn.limited_reserve_transfer_assets.html
    const tx = frequency.api.tx.polkadotXcm.limitedReserveTransferAssets(
      {
        // Versioned Location,
        // Destination context for the assets.
        // V3 = MultiLocation, a relative location to Frequency.
        // destination = asset hub:  go up 1, interior is down, to parachain id
        V3: { parents: 1, interior: { X1: { Parachain: AssetHubID } } },
      },
      {
        V3: {
          // Versioned Location, beneficiary = bob, on the current chain (this would be the chain of 'dest')
          parents: 0,
          interior: {
            X1: { AccountId32: { network: null, id: bob.addressRaw } },
          },
        },
      },
      { V3: [transferRelayDOTRelativeToParachain()] },
      0, // fee_asset_item
      "Unlimited", // weight limit
    );

    await sendTransaction(tx.signAsync(alice));
    await frequency.chain.newBlock();
    await checkHrmp(frequency).toMatchSnapshot(
      "frequency-outbound-hrmp-messages",
    );
    await checkSystemEvents(frequency).toMatchSnapshot(
      "frequency-after-sending-xcm-events",
    );
    await check(
      frequency.api.query.system.account(alice.address),
    ).toMatchSnapshot();

    await assetHub.chain.newBlock();

    await checkSystemEvents(
      assetHub,
      "xcmpQueue",
      "dmpQueue",
      "messageQueue",
    ).toMatchSnapshot("assethub-receive-chain-xcm events");
    // await checkHrmp(assetHub).toMatchSnapshot('frequencyOutbout-hrmp-messages');

    await check(
      frequency.api.query.system.account(alice.address),
    ).toMatchSnapshot();
    await check(
      assetHub.api.query.system.account(alice.address),
    ).toMatchSnapshot();
  });

  fc.assert(
    fc.asyncProperty(
      // --------
      // arrange: set up some balances
      // --------
      fc.array(fc.integer({ min: 1 }), { maxLength: 20 }), // arbitraries
      async (balances) => {
        it("arbs on addresses and balance amounts", async () => {
          try {
            for (const balance of balances) {
              await setStorage(frequency.chain, {
                ...defaultStorage,
                System: {
                  Account: [accountWithFreeBalance(alice.address, balance)],
                },
                ForeignAssets: createForeignDOTStorage(
                  alice.address,
                  balance,
                  alice.address,
                  balance,
                ),
              });

              await setStorage(assetHub.chain, {
                System: {
                  // seed sovereign account
                  Account: [
                    accountWithFreeBalance(alice.address, balance),
                    accountWithFreeBalance(SIB),
                  ],
                },
              });

              await frequency.chain.newBlock();
              await assetHub.chain.newBlock();

              await checkSystemEvents(frequency).toMatchSnapshot(
                "frequency-initial-events",
              );
              await checkSystemEvents(assetHub).toMatchSnapshot(
                "assetHub-initial-events",
              );

              // --------
              // Act
              // --------
              // https://paritytech.github.io/polkadot-sdk/master/pallet_xcm/pallet/dispatchables/fn.limited_reserve_transfer_assets.html
              const tx =
                frequency.api.tx.polkadotXcm.limitedReserveTransferAssets(
                  {
                    // dest
                    V3: {
                      parents: 1,
                      interior: { X1: { Parachain: AssetHubID } },
                    },
                  },
                  {
                    V3: {
                      // beneficiary = bob - relative to dest
                      parents: 0,
                      interior: {
                        X1: {
                          AccountId32: { network: null, id: bob.addressRaw },
                        },
                      },
                    },
                  },
                  { V3: [transferRelayDOTRelativeToParachain(balance)] }, // assets
                  0, // fee_asset_item
                  "Unlimited", // weight limit
                );

              await sendTransaction(tx.signAsync(alice));
              await frequency.chain.newBlock();

              // --------
              // Assert
              // --------
              await checkHrmp(frequency).toMatchSnapshot(
                "frequency-outbound-hrmp-messages",
              );
              await checkSystemEvents(frequency).toMatchSnapshot(
                "frequency-after-sending-xcm-events",
              );
              await check(
                frequency.api.query.system.account(alice.address),
              ).toMatchSnapshot();

              await assetHub.chain.newBlock();
              await checkSystemEvents(
                assetHub,
                "xcmpQueue",
                "dmpQueue",
                "messageQueue",
                {
                  section: "system",
                  method: "ExtrinsicSuccess",
                },
              ).toMatchSnapshot("assethub-receive-chain-xcm events");
            }
          } catch (e: Error | any) {
            if (e.message.includes("Normal Closure")) {
              console.error("saw normal closure?");
              return;
            }
            throw e;
          } //end catch
        }); // end it
      }, // end async
    ), // end fc.asyncProperty
    { verbose: false },
  ); //  end fc.assert
});
