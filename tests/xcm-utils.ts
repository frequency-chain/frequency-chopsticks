import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';

export async function waitForXcmMessage(api: ApiPromise, blockHash?: string): Promise<any[]> {
  const events = await api.query.system.events.at(blockHash);
  return events
    .filter(
      ({ event }) =>
        api.events.xcmpQueue?.XcmpMessageSent?.is(event) ||
        api.events.dmpQueue?.ExecutedDownward?.is(event) ||
        api.events.ump?.ExecutedUpward?.is(event)
    )
    .map(({ event }) => event);
}

export async function getAccountBalance(
  api: ApiPromise,
  account: string,
  assetId?: number
): Promise<string> {
  if (assetId) {
    // Get asset balance
    const balance = await api.query.assets?.account?.(assetId, account);
    return balance?.toJSON()?.balance?.toString() || '0';
  } else {
    // Get native token balance
    const account_info = await api.query.system.account(account);
    return account_info.data.free.toString();
  }
}
