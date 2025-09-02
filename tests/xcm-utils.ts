import { ApiPromise } from '@polkadot/api'
import { BN } from '@polkadot/util'

export interface XcmTransferParams {
  from: any
  to: string
  amount: string | BN
  assetId?: number
}

export async function createXcmTransfer(
  sourceApi: ApiPromise,
  destApi: ApiPromise, 
  params: XcmTransferParams
) {
  // Create XCM message for asset transfer
  const destination = {
    V3: {
      parents: 1,
      interior: {
        X1: {
          Parachain: await getParachainId(destApi)
        }
      }
    }
  }
  
  const beneficiary = {
    V3: {
      parents: 0,
      interior: {
        X1: {
          AccountId32: {
            network: null,
            id: params.to
          }
        }
      }
    }
  }
  
  const assets = {
    V3: [
      {
        id: {
          Concrete: {
            parents: 0,
            interior: params.assetId ? 
              { X2: [{ PalletInstance: 50 }, { GeneralIndex: params.assetId }] } :
              'Here'
          }
        },
        fun: {
          Fungible: params.amount
        }
      }
    ]
  }
  
  return {
    destination,
    beneficiary, 
    assets,
    feeAssetItem: 0
  }
}

export async function getParachainId(api: ApiPromise): Promise<number> {
  const parachainInfo = await api.query.parachainInfo?.parachainId()
  return parachainInfo?.toNumber() || 0
}

export async function waitForXcmMessage(api: ApiPromise, blockHash?: string): Promise<any[]> {
  const events = await api.query.system.events.at(blockHash)
  return events
    .filter(({ event }) => 
      api.events.xcmpQueue?.XcmpMessageSent?.is(event) ||
      api.events.dmpQueue?.ExecutedDownward?.is(event) ||
      api.events.ump?.ExecutedUpward?.is(event)
    )
    .map(({ event }) => event)
}

export async function getAccountBalance(
  api: ApiPromise, 
  account: string, 
  assetId?: number
): Promise<string> {
  if (assetId) {
    // Get asset balance
    const balance = await api.query.assets?.account?.(assetId, account)
    return balance?.toJSON()?.balance?.toString() || '0'
  } else {
    // Get native token balance
    const account_info = await api.query.system.account(account)
    return account_info.data.free.toString()
  }
}