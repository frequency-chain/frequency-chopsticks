import { Api } from '@acala-network/chopsticks'
import { Blockchain, BuildBlockMode, type StorageValues } from '@acala-network/chopsticks-core'
import { withExpect } from '@acala-network/chopsticks-testing'
import { ApiPromise, WsProvider } from '@polkadot/api'
import type { RegisteredTypes } from '@polkadot/types/types'
import type { HexString } from '@polkadot/util/types'
import { getObservableClient } from '@polkadot-api/observable-client'
import { createClient as createSubstrateClient, type SubstrateClient } from '@polkadot-api/substrate-client'
import { beforeAll, beforeEach, expect, type Mock, vi } from 'vitest'


export { setupContext, testingPairs } from '@acala-network/chopsticks-testing'

export type SetupOption = {
  endpoint?: string | string[]
  blockHash?: HexString
  mockSignatureHost?: boolean
  allowUnresolvedImports?: boolean
  genesis?: string
  registeredTypes?: RegisteredTypes
  runtimeLogLevel?: number
  processQueuedMessages?: boolean
  rpcTimeout?: number
}

export const env = {
  acala: {
    endpoint: 'wss://acala-rpc.aca-api.network',
    // 3,800,000
    blockHash: '0x0df086f32a9c3399f7fa158d3d77a1790830bd309134c5853718141c969299c7' as HexString,
  },
  acalaV15: {
    endpoint: 'wss://acala-rpc.aca-api.network',
    // 6,800,000
    blockHash: '0x6c74912ce35793b05980f924c3a4cdf1f96c66b2bedd0c7b7378571e60918145' as HexString,
  },
  rococo: {
    endpoint: 'wss://rococo-rpc.polkadot.io',
    blockHash: '0xd7fef00504decd41d5d2e9a04346f6bc639fd428083e3ca941f636a8f88d456a' as HexString,
  },
}


interface TestPolkadotApi {
  ws: WsProvider
  chain: Blockchain
  client: PolkadotClient
  substrateClient: SubstrateClient
  observableClient: ObservableClient
  teardown: () => Promise<void>
}

export let api: ApiPromise
export let chain: Blockchain
export let ws: WsProvider

type ObservableClient = ReturnType<typeof getObservableClient>

export const dev = {
  newBlock: (param?: { count?: number; to?: number }): Promise<string> => {
    return ws.send('dev_newBlock', [param])
  },
  setStorage: (values: StorageValues, blockHash?: string) => {
    return ws.send('dev_setStorage', [values, blockHash])
  },
  timeTravel: (date: string | number) => {
    return ws.send<number>('dev_timeTravel', [date])
  },
  setHead: (hashOrNumber: string | number) => {
    return ws.send('dev_setHead', [hashOrNumber])
  },
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const { check, checkHex, checkSystemEvents } = withExpect(expect)

export { check, checkHex, checkSystemEvents }
