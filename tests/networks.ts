import {
  type SetupOption,
  setupContext,
} from "@acala-network/chopsticks-testing";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

// Type for network endpoints
export type NetworkEndpoints = {
  polkadot: string[];
  frequency: string[];
  assetHub: string[];
};

const endpoints: NetworkEndpoints = {
  polkadot: ["wss://rpc.ibp.network/polkadot"],
  frequency: ["wss://0.rpc.frequency.xyz"],
  assetHub: ["wss://polkadot-asset-hub-rpc.polkadot.io"],
};

const toNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return Number(value);
};

export type Network = Awaited<ReturnType<typeof setupContext>>;

// use frequency mainnet state with the compiled wasm that has the bridging feature.
// use assethub mainnet state with compiled wasm for the logging
export default {
  polkadot: (options?: Partial<SetupOption>): Promise<Network> => {
    console.log("Setting up Polkadot network with options:", {
      wasmOverride: process.env.POLKADOT_WASM || undefined,
      blockNumber: toNumber(process.env.POLKADOT_BLOCK_NUMBER) || 27781571,
      endpoint: process.env.POLKADOT_ENDPOINT ?? endpoints.polkadot,
      db: !process.env.RUN_TESTS_WITHOUT_DB
        ? "./db/polkadot-db.sqlite"
        : undefined,
    });
    return setupContext({
      wasmOverride: process.env.POLKADOT_WASM || undefined,
      blockNumber: toNumber(process.env.POLKADOT_BLOCK_NUMBER) || 27781571,
      endpoint: process.env.POLKADOT_ENDPOINT ?? endpoints.polkadot,
      db: !process.env.RUN_TESTS_WITHOUT_DB
        ? "./db/polkadot-db.sqlite"
        : undefined,
      ...options,
    });
  },
  frequency: (options?: Partial<SetupOption>): Promise<Network> => {
    return setupContext({
      wasmOverride: process.env.FREQUENCY_WASM || undefined,
      blockNumber: toNumber(process.env.FREQUENCY_BLOCK_NUMBER) || 3000000,
      endpoint: process.env.FREQUENCY_ENDPOINT ?? endpoints.frequency,
      db: !process.env.RUN_TESTS_WITHOUT_DB
        ? "./db/frequency-db.sqlite"
        : undefined,
      runtimeLogLevel: 5,
      processQueuedMessages: true,
      ...options,
    });
  },
  assetHub: (options?: Partial<SetupOption>): Promise<Network> => {
    const config: SetupOption = {
      wasmOverride: process.env.ASSET_HUB_WASM || undefined,
      runtimeLogLevel: 5,
      blockNumber: toNumber(process.env.ASSET_HUB_BLOCK_NUMBER) || 9669797,
      port: options?.port || 0, // Use 0 for dynamic port assignment
      endpoint: process.env.ASSET_HUB_ENDPOINT ?? endpoints.assetHub,
      db: !process.env.RUN_TESTS_WITHOUT_DB
        ? "./db/assethub-db.sqlite"
        : undefined,
      processQueuedMessages: true,
      ...options,
    };

    console.log("Setting up AssetHub network with options:", config);

    return setupContext(config);
  },
};
