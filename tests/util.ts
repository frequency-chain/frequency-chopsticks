import { u8aToHex } from "@polkadot/util";

// https://substrate.stackexchange.com/questions/1200/how-to-calculate-sovereignaccount-for-parachain/1210
/**
 * Get the sibling sovereign account for a parachain
 * This is the account that holds the parachain's sovereign funds on the relay chain
 */
export async function getSiblingSovereignAccount(
  paraId: number,
): Promise<string> {
  // The sibling sovereign account is derived from the parachain ID
  // Format: ParaId(paraId).into_account_truncating()
  const paraIdBytes = new Uint8Array(4);
  paraIdBytes[0] = paraId & 0xff;
  paraIdBytes[1] = (paraId >> 8) & 0xff;
  paraIdBytes[2] = (paraId >> 16) & 0xff;
  paraIdBytes[3] = (paraId >> 24) & 0xff;

  // Create the account ID using the standard derivation
  // This is a simplified version - in practice you'd use the full Substrate derivation
  // sibl 73 69 62 6c
  const accountId = new Uint8Array(32);
  accountId[0] = 0x73; // 'para' prefix
  accountId[1] = 0x69; // 'ra'
  accountId[2] = 0x62; // 'r'
  accountId[3] = 0x6c; // 'a'

  // Copy the para ID bytes
  for (let i = 0; i < 4; i++) {
    accountId[4 + i] = paraIdBytes[i];
  }

  // The rest is padded with zeros
  for (let i = 8; i < 32; i++) {
    accountId[i] = 0;
  }

  return u8aToHex(accountId);
}

export function checkingAccount(): string {
  const prefix = new Uint8Array(4);
  prefix[0] = 0x6d; // m
  prefix[1] = 0x6f; // o
  prefix[2] = 0x64; // d
  prefix[3] = 0x6c; // l

  const palletId = new Uint8Array(8);
  palletId[0] = 0x70; // p
  palletId[1] = 0x79; // y
  palletId[2] = 0x2f; // /
  palletId[3] = 0x78; // x
  palletId[4] = 0x63; // c
  palletId[5] = 0x6d; // m
  palletId[6] = 0x63; // c
  palletId[7] = 0x68; // h

  let accountId = new Uint8Array(32);

  for (let i = 0; i < 4; i++) {
    accountId[i] = prefix[i];
  }

  for (let i = 0; i < 8; i++) {
    accountId[i + 4] = palletId[i];
  }

  for (let i = 0; i < 32; i++) {
    accountId[i + 12] = 0;
  }

  return u8aToHex(accountId);
}

export async function getChildSovereignAccount(
  paraId: number,
): Promise<string> {
  // The sibling sovereign account is derived from the parachain ID
  // Format: ParaId(paraId).into_account_truncating()
  const paraIdBytes = new Uint8Array(4);
  paraIdBytes[0] = paraId & 0xff;
  paraIdBytes[1] = (paraId >> 8) & 0xff;
  paraIdBytes[2] = (paraId >> 16) & 0xff;
  paraIdBytes[3] = (paraId >> 24) & 0xff;

  // Create the account ID using the standard derivation
  // This is a simplified version - in practice you'd use the full Substrate derivation
  const accountId = new Uint8Array(32);
  accountId[0] = 0x70; // 'para' prefix
  accountId[1] = 0x61; // 'ra'
  accountId[2] = 0x72; // 'r'
  accountId[3] = 0x61; // 'a'

  // Copy the para ID bytes
  for (let i = 0; i < 4; i++) {
    accountId[4 + i] = paraIdBytes[i];
  }

  // The rest is padded with zeros
  for (let i = 8; i < 32; i++) {
    accountId[i] = 0;
  }

  return u8aToHex(accountId);
}

// Send transaction and wait for it to be included
export async function sendTransactionAndWait(
  tx: any,
  alice: any,
  chain: any,
): Promise<boolean> {
  return await new Promise(async (resolve, reject) => {
    const unsub = await tx.signAndSend(
      alice,
      async ({
        status,
        events,
        dispatchError,
      }: {
        status: any;
        events: any;
        dispatchError: any;
      }) => {
        console.log(`Transaction status: ${status.toString()}`);

        if (status.isInvalid) {
          console.log("❌ Transaction is invalid");
          unsub();
          reject(new Error("Transaction is invalid"));
          return;
        }

        if (status.isDropped) {
          console.log("❌ Transaction is dropped");
          unsub();
          reject(new Error("Transaction is dropped"));
          return;
        }

        if (status.isReady) {
          console.log("✅ Transaction is ready in pool");
          // Create block to process the transaction
          await chain.chain.newBlock();
          console.log("✅ Block created to process transaction");
        }

        if (status.isInBlock) {
          console.log("✅ Transaction is in block");

          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = chain.api.registry.findMetaError(
                dispatchError.asModule,
              );
              console.log(
                "❌ Dispatch error:",
                `${decoded.section}.${decoded.name}`,
              );
            } else {
              console.log("❌ Dispatch error:", dispatchError.toString());
            }
            unsub();
            reject(new Error(`Dispatch error: ${dispatchError.toString()}`));
            return;
          }

          console.log("✅ Transaction successful, unsubscribing...");
          unsub();
          resolve(true);
        }
      },
    );
  });
}

/**
 * Helper function to get account balance as BigInt
 * @param api - Polkadot API instance
 * @param address - Account address
 * @returns Account balance as BigInt
 */
export const getAccountBalance = async (api: any, address: string): Promise<bigint> => {
  const accountData = await api.query.system.account(address);
  return accountData.data.free.toBigInt();
};

/**
 * Helper function to get foreign asset balance as BigInt
 * @param api - Polkadot API instance
 * @param assetLocation - Asset location object
 * @param address - Account address
 * @returns Foreign asset balance as BigInt
 */
export const getForeignAssetBalance = async (
  api: any,
  assetLocation: any,
  address: string
): Promise<bigint> => {
  const assetAccount = await api.query.foreignAssets.account(assetLocation, address);
  const balanceStr = (assetAccount.toHuman() as any).balance.replace(/,/g, '');
  return BigInt(balanceStr);
};
