import { type SetupOption, setupContext, setupNetworks } from '@acala-network/chopsticks-testing';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const endpoints = {
  polkadot: ['wss://rpc.ibp.network/polkadot'],
  frequency: ['wss://0.rpc.frequency.xyz'],
  // assetHub: ['wss://asset-hub-polkadot-rpc.n.dwellir.com'],
  // assetHub: ['wss://polkadot-asset-hub-rpc.polkadot.io']
  // assetHub: ['wss://statemint.api.onfinality.io/public-ws'],
  assetHub: ['wss://polkadot-asset-hub-rpc.polkadot.io'],
  // assetHub: ['wss://pas-rpc.stakeworld.io/assethub']
};

const toNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return Number(value);
};

export type Network = Awaited<ReturnType<typeof setupContext>>;

export default {
  polkadot: (options?: Partial<SetupOption>) => {
    console.log('Setting up Polkadot network with options:', {
      wasmOverride: process.env.POLKADOT_WASM || undefined,
      blockNumber: toNumber(process.env.POLKADOT_BLOCK_NUMBER) || 14500000,
      endpoint: process.env.POLKADOT_ENDPOINT ?? endpoints.polkadot,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'polkadot-db.sqlite' : undefined,
    });
    return setupContext({
      wasmOverride: process.env.POLKADOT_WASM || undefined,
      blockNumber: toNumber(process.env.POLKADOT_BLOCK_NUMBER) || 14500000,
      endpoint: process.env.POLKADOT_ENDPOINT ?? endpoints.polkadot,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'polkadot-db.sqlite' : undefined,
      ...options,
    });
  },
  frequency: (options?: Partial<SetupOption>) => {
    return setupContext({
      wasmOverride: process.env.FREQUENCY_WASM || undefined,
      blockNumber: toNumber(process.env.FREQUENCY_BLOCK_NUMBER) || 3000000,
      endpoint: process.env.FREQUENCY_ENDPOINT ?? endpoints.frequency,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'frequency-db.sqlite' : undefined,
      runtimeLogLevel: 5,
      processQueuedMessages: true,
      ...options,
    });
  },
  assetHub: (options?: Partial<SetupOption>) => {
    const config = {
      wasmOverride: process.env.ASSET_HUB_WASM || undefined,
      runtimeLogLevel: 5,
      blockNumber: toNumber(process.env.ASSET_HUB_BLOCK_NUMBER) || 9669797,
      port: 8001,
      endpoint: process.env.ASSET_HUB_ENDPOINT ?? endpoints.assetHub,
      db: !process.env.RUN_TESTS_WITHOUT_DB ? 'assethub-db.sqlite' : undefined,
      processQueuedMessages: true,
      ...options,
    };

    console.log('Setting up AssetHub network with options:', config);

    return setupContext(config);
  },
};
