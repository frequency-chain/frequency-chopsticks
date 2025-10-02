import { expect } from "vitest"; // sovereign account id for Frequency
import { setStorage } from "@acala-network/chopsticks-core";
import { withExpect } from "@acala-network/chopsticks-testing";
import {
  testingPairs,
  sendTransaction,
} from "@acala-network/chopsticks-testing";
import { connectParachains } from "@acala-network/chopsticks";
import fc from "fast-check";
import {
  accountWithFreeBalance,
  assertFreeBalanceOver,
  createForeignDOTStorage,
  transferRelayDOTRelativeToParachain,
} from "../account-utils";

const { check, checkSystemEvents, checkHrmp } = withExpect(expect);
import networks, { type Network } from "../../networks.js";

// sovereign account id for Frequency
const SIB = "5Eg2fnsixbRfQGTeUNds5WBdpL3gvhUzF9yPCnaKX43Pc7Dk";
const AssetHubID = 1000;
const FrequencyId = 2091;

let frequency: Network;
let assetHub: Network;

const SupportedVersion = [
  [
    [
      5,
      {
        V5: { parents: 1, interior: { X1: [{ Parachain: AssetHubID }] } },
      },
    ],
    4,
  ],
];

const { alice, bob } = testingPairs();
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
const supply = 1000e10;
// const aliceBalance = 700e6;
// const aliceDotBalance = 700e6;
const aliceDotBalanceAssetHub = 700e6;
// const SIBBalance = 100e12;
const maximumFee = 100e6;

fc.assert(
  fc.asyncProperty(
    fc.integer({ min: 1, max: 1000e10 }),
    fc.integer({ min: 1, max: 999e10 }),
    fc.integer({ min: 1 }), // arbitraries
    async (aliceBalance, aliceDotBalance, SIBBalance) => {
      test("arbs on addresses and balance amounts", async () => {
        frequency = await networks.frequency();
        assetHub = await networks.assetHub();

        await connectParachains([frequency.chain, assetHub.chain], false);
        await setStorage(frequency.chain, defaultStorage);

        // Set the account balances on Frequency
        await setStorage(frequency.chain, {
          ...defaultStorage,
          System: {
            Account: [accountWithFreeBalance(alice.address, aliceBalance)],
          },
          ForeignAssets: createForeignDOTStorage(
            alice.address,
            supply, // supply of DOT in Frequency
            alice.address,
            aliceDotBalance,
          ),
        });

        // set the account balances on AssetHub
        await setStorage(assetHub.chain, {
          System: {
            // seed sovereign account
            Account: [
              accountWithFreeBalance(alice.address, aliceDotBalanceAssetHub),
              accountWithFreeBalance(SIB, SIBBalance),
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
          // { V3: [transferRelayDOTRelativeToParachain(balance)] }, // assets
          { V3: [transferRelayDOTRelativeToParachain()] }, // assets
          0, // fee_asset_item
          "Unlimited", // weight limit
        );

        await sendTransaction(tx.signAsync(alice));
        await frequency.chain.newBlock();

        // await checkSystemEvents(frequency).toMatchSnapshot(
        //   "frequency-after-sending-xcm-events",
        // );
        const val = await await check(
          frequency.api.query.system.account(alice.address),
        ).value();
        assertFreeBalanceOver(val, aliceBalance - maximumFee);

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
        await frequency.teardown();
        await assetHub.teardown();
      }); // end test
    }, // end async
  ), // end fc.asyncProperty
); //  end fc.assert
