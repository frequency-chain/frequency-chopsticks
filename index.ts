import { config as dotenvConfig } from 'dotenv';
import { ApiPromise } from '@polkadot/api';
import { WsProvider } from '@polkadot/rpc-provider';
import { setupContext } from '@acala-network/chopsticks-testing';

// Load environment variables
dotenvConfig();

// async function connectToFork() {
//   const wsProvider = new WsProvider('ws://localhost:8000');
//   const api = await ApiPromise.create({ provider: wsProvider });
//   await api.isReady;

//   // Now you can use 'api' to interact with your fork
//   console.log(`Connected to chain: ${await api.rpc.system.chain()}`);
// }

async function main() {
  // await connectToFork()
  const api = new ApiPromise({
    provider: new WsProvider('ws://localhost:8000'),
    noInitWarn: true,
  });

  // wasmOverride: process.env.FREQUENCY_WASM || undefined,
  // blockNumber: toNumber(process.env.FREQUENCY_BLOCK_NUMBER) || 3000000,
  // endpoint: process.env.FREQUENCY_ENDPOINT ?? endpoints.frequency,
  // db: !process.env.RUN_TESTS_WITHOUT_DB ? './db/frequency-db.sqlite' : undefined,
  // runtimeLogLevel: 5,
  // processQueuedMessages: true,

  try {
    // Wait for API to be ready
    await api.isReady;

    // // Get chain info
    const chain = await api.rpc.system.chain();
    console.log('Connected to chain:', chain.toString());

    // Get current block height using header instead of full block
    // const header = await api.rpc.chain.getHeader();

    // Use chopsticks-specific dev methods
    try {
      // await chain.newBlock({ count: 1 });
      await api.rpc('dev_newBlock', {
        count: 1,
        transactions: ['0x02000bd00d37f59901'],
      });

      //  });
      // const blockHash = await api.rpc.chain.getBlockHash(9631259);
      // const humanHash = blockHash.toHuman();
      // console.log("hell----- 2");
      // const signedBlock = await api.rpc.chain.getBlock(blockHash);
      // console.log('Block header:', signedBlock.block.header.toHuman());
      // console.log("hell-----3");
      // console.log("signedblock", signedBlock.toHuman())
      // const { block } = signedBlock;
      // console.log("---------block", block);
      // block.forEach((tx) => {
      //   console.log(tx.toHuman());
      // })

      // const txHash = await api.rpc.author.submitExtrinsic("0x29058400ec011afb28b9b4cbddf652b7b1af0b33bf358df5a9756805f788e8c01995ed7601d673122d2131edb3d281e690be0e5e384286088a7a8ad97478c5b947246ed8134bb94a03f07b02cc62e497da0354812e84ade02e3fefa9af0efc99b69836778435012000001e0102001002439e36cb128d42cb0328a829792d517e4b045d0104c748f2ecce4a6a538e301a9f187ebf2678d24ceef6dc142a702ca869757c7854158b4cea9515a458cc6d44973dd932ce1464ac24c6d233ce8d25a5f48b941bca2b4b63b47753e3f37154466641003e37881a15ebe80e51ffc08915ffcd5ca7fd8ce9fff37d743afbc03201f3f39200040000002b000052b734bf6141c8535eb72a75c034d790eaa1e713e4f9741d3e587d62adebcc6b002b0000f71b67cbe715731652e695271731c450b5a26cf2931a9b5da5d6a4303088680b0103400603388609413eec0100");
      // console.log('Submitted, tx hash =', txHash.toHex());

      console.log('Created new block successfully');
    } catch (error) {
      console.log(
        'Dev methods not available:',
        error instanceof Error ? error.message : String(error)
      );
    }

    console.log('Hello, world!');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  } finally {
    await api.disconnect();
  }
}

main().catch(console.error);
