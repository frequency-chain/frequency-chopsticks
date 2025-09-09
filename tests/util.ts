import { ApiPromise, WsProvider } from '@polkadot/api';
import { u8aToHex } from '@polkadot/util';
import { ParaId } from '@polkadot/types/interfaces';

const relayURL = 'wss://kusama-rpc.polkadot.io';

const relayProvider = new WsProvider(relayURL);

let relayApi: ApiPromise;

async function getRelayApi() {
  if (!relayApi) {
    relayApi = await ApiPromise.create({
      provider: relayProvider,
      noInitWarn: true,
    });
  }
  return relayApi;
}

export async function getSiblingSovereignAccount(targetParaId: number) {
  const relayApi = await getRelayApi();
  const paradId: ParaId = relayApi.createType('ParaId', targetParaId);

  const sovAddressPara = u8aToHex(
    new Uint8Array([...new TextEncoder().encode('sibl'), ...paradId.toU8a()])
  ).padEnd(66, '0');

  return sovAddressPara;
}

export async function getChildSovereignAccount(targetParaId: number) {
  const relayApi = await getRelayApi();
  const paradId: ParaId = relayApi.createType('ParaId', targetParaId);

  const sovAddressRelay = u8aToHex(
    new Uint8Array([...new TextEncoder().encode('para'), ...paradId.toU8a()])
  ).padEnd(66, '0');

  return sovAddressRelay;
}
