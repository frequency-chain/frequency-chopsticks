import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { setupContext, testingPairs } from '@acala-network/chopsticks-testing';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { count } from 'node:console';

const endpoints = {
  frequency: ['wss://0.rpc.testnet.amplica.io'],
};

describe('runtime upgrade', async () => {
  const { alice } = testingPairs();
  const { api, dev, chain, teardown } = await setupContext({
    endpoint: endpoints.frequency,
    timeout: 300_000,
    wasmOverride: "./wasm/frequency-paseo_runtime-v176.v1.17.4.compact.compressed.wasm",
    blockNumber: 6087413,
    allowUnresolvedImports: true,
    db: './db/frequency-upgrade.sqlite',
    runtimeLogLevel: 5,
    processQueuedMessages: true,
    // uncomment to see more logs
    // logLevel: 'debug',
  });

  beforeAll(async () => {
    await dev.setStorage({
      Sudo: {
        Key: alice.address,
      },
      System: {
        Account: [[[alice.address], { providers: 1, data: { free: 1000n * 10n ** 18n } }]],
      },
    });
  });

  afterAll(async () => {
    await teardown();
  });

  // Execution hook before runtime upgrade. To test storage migrations, set up the storage items
  // via transactions, set storage etc.
  const beforeUpgrade = async () => { };

  // Execution hook after runtime upgrade. To verify storage migrations work, query the migrated
  // storage items or send transactions that interact with them.
  const afterUpgrade = async () => {
    // Dummy test. Change it to test your storage migrations.
    let isFinalized = false;
    let unsub = await api.tx.system.remark('Hello World').signAndSend(alice, result => {
      if (result.status.isFinalized) {
        isFinalized = true;
        unsub();
      }
    });
    await dev.newBlock();
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(isFinalized).toBe(true);
  };

  it('runtime upgrade works', async () => {
    //await beforeUpgrade();

    const prevSpecVersion = api.runtimeVersion.specVersion.toNumber();
    expect(prevSpecVersion).toBe(176);
    console.log('SpecVersion before upgrade: ', prevSpecVersion);
    const codePath = path.join(
      __dirname,
      `../wasm/frequency-paseo_runtime-v178.v1.17.5-rc2.compact.compressed.wasm`
    );
    const code = readFileSync(codePath);
    // await api.tx.sudo
    //   .sudoUncheckedWeight(api.tx.system.setCode('0x' + code.toString('hex')), {})
    //   .signAndSend(alice);

    // Do block production.
    await chain.newBlock();
    // wait a bit for pjs/api to reflect runtimeVersion change
    await new Promise(r => setTimeout(r, 5000));

    // The spec version is increased.
    const curSpecVersion = api.runtimeVersion.specVersion.toNumber();
    console.log('SpecVersion after upgrade: ', curSpecVersion);
    expect(curSpecVersion).toBeGreaterThan(prevSpecVersion);

    //await afterUpgrade();
  });
});
