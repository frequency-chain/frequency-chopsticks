// return a storage object for an account with free balance = `amount`
import { expect } from "vitest";

export const accountWithFreeBalance = (
  address: string,
  free: number = 1000e12,
) => {
  return [[address], { data: { free } }];
};

// create a storage object for Relay Chain token (generally, DOT) using the provided parameters
// owner:  the owner of the foreign asset.
// supply:  how much total of the asset is on this chain
// tokenHolder: the account to set up with some of this token
// balance: how much free balance tokenHolder should have.
export const createForeignDOTStorage = (
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
// example:
//   parents: 1 means go up 1 level from the parachain, so, to the relay chain
//   interior: 'Here' means the asset native to that location i.e. to relay chain, i.e. DOT.
//   in short: transfer `amount`  DOT (relay-native)
//   V3: [{ id: { Concrete: { parents: 1, interior: 'Here' } }, fun: { Fungible: 8 * 1e12 } }],
export const transferRelayDOTRelativeToParachain = (
  amount: number = 8 * 1e12,
) => {
  return {
    id: { Concrete: { parents: 1, interior: "Here" } },
    fun: { Fungible: amount },
  };
};

export const assertFreeBalanceOver = (
  systemAccount: any,
  amount: number,
): void => {
  const expected = {
    consumers: 0,
    data: {
      flags: "0x80000000000000000000000000000000",
      free: expect.anything(),
      frozen: 0,
      reserved: 0,
    },
    nonce: 0,
    providers: 1,
    sufficients: 0,
  };
  expect(systemAccount).toMatchObject(expected);
  expect(systemAccount.data.free).toBeGreaterThan(amount);
};
