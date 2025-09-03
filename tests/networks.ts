import { type SetupOption, setupContext, setupNetworks } from '@acala-network/chopsticks-testing'
import { config as dotenvConfig } from 'dotenv'

dotenvConfig()

const endpoints = {
  polkadot: ['wss://rpc.ibp.network/polkadot'],
  frequency: ['wss://0.rpc.frequency.xyz'],
  assetHub: ['wss://asset-hub-polkadot-rpc.n.dwellir.com'],
}

const toNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  return Number(value)
}

export type Network = Awaited<ReturnType<typeof setupContext>>

export default {
  polkadot: (options?: Partial<SetupOption>) => {
    console.log('Setting up Polkadot network with options:', {
      wasmOverride: process.env.POLKADOT_WASM || undefined,
      blockNumber: toNumber(process.env.POLKADOT_BLOCK_NUMBER) || 14500000,
      endpoint: process.env.POLKADOT_ENDPOINT ?? endpoints.polkadot,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'polkadot-db.sqlite' : undefined,
    })
    return setupContext({
      wasmOverride: process.env.POLKADOT_WASM || undefined,
      blockNumber: toNumber(process.env.POLKADOT_BLOCK_NUMBER) || 14500000,
      endpoint: process.env.POLKADOT_ENDPOINT ?? endpoints.polkadot,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'polkadot-db.sqlite' : undefined,
      ...options,
    })
  },
  frequency: (options?: Partial<SetupOption>) => {
    console.log('Setting up Frequency network with options:', {
      wasmOverride: process.env.FREQUENCY_WASM || undefined,
      blockNumber: toNumber(process.env.FREQUENCY_BLOCK_NUMBER) || 3000000,
      endpoint: process.env.FREQUENCY_ENDPOINT ?? endpoints.frequency,
      port: 8000,
      mockSignatureHost: true,
      runtimeLogLevel: 5,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'frequency-db.sqlite' : undefined,
    })
    return setupContext({
      wasmOverride: process.env.FREQUENCY_WASM || undefined,
      blockNumber: toNumber(process.env.FREQUENCY_BLOCK_NUMBER) || 3000000,
      endpoint: process.env.FREQUENCY_ENDPOINT ?? endpoints.frequency,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'frequency-db.sqlite' : undefined,
      runtimeLogLevel: 5,
      processQueuedMessages: true,
      ...options,
    })
  },
  assetHub: (options?: Partial<SetupOption>) => {
    return setupContext({
      wasmOverride: process.env.ASSET_HUB_WASM || undefined,
      runtimeLogLevel: 5,
      blockNumber: toNumber(process.env.ASSET_HUB_BLOCK_NUMBER) || 3000000,
      endpoint: process.env.ASSET_HUB_ENDPOINT ?? endpoints.assetHub,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'asset-hub-db.sqlite' : undefined,
      ...options,
    })
  },
  network: (options?: Partial<Record<string, | string | undefined>>) => {
      return setupNetworks({
        frequency: {
        wasmOverride: process.env.FREQUENCY_WASM || undefined,
        runtimeLogLevel: 5,
        blockNumber: toNumber(process.env.FREQUENCY_BLOCK_NUMBER) || 3000000,
          endpoint: process.env.FREQUENCY_ENDPOINT ?? endpoints.frequency,
          db: !process.env.RUN_TESTS_WITHOUT_DB ? 'frequency-db.sqlite' : undefined,
          ...options,
        },
        assetHub: {
          wasmOverride: process.env.ASSET_HUB_WASM || undefined,
          runtimeLogLevel: 5,
          blockNumber: toNumber(process.env.ASSET_HUB_BLOCK_NUMBER) || 3000000,
          endpoint: process.env.ASSET_HUB_ENDPOINT ?? endpoints.assetHub,
          db: !process.env.RUN_TESTS_WITHOUT_DB ? 'asset-hub-db.sqlite' : undefined,
          ...options,
        },
        polkadot: {
          wasmOverride: process.env.POLKADOT_WASM || undefined,
          runtimeLogLevel: 5,
          blockNumber: toNumber(process.env.POLKADOT_BLOCK_NUMBER) || 14500000,
          endpoint: process.env.POLKADOT_ENDPOINT ?? endpoints.polkadot,
          db: !process.env.RUN_TESTS_WITHOUT_DB ? 'polkadot-db.sqlite' : undefined,
          ...options,
      }})
    }
}