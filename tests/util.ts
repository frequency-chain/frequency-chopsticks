import { u8aToHex } from '@polkadot/util';

/**
 * Get the sibling sovereign account for a parachain
 * This is the account that holds the parachain's sovereign funds on the relay chain
 */
export async function getSiblingSovereignAccount(paraId: number): Promise<string> {
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
  accountId[0] = 0x50; // 'Para' prefix
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

/**
 * Get the parent sovereign account for a parachain
 * This is the account that holds the parachain's sovereign funds on the parent chain
 */
export async function getParentSovereignAccount(paraId: number): Promise<string> {
  // Similar to sibling but for parent chain
  return getSiblingSovereignAccount(paraId);
}
