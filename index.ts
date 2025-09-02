import { config as dotenvConfig } from 'dotenv'
import { ApiPromise } from '@polkadot/api'
import { WsProvider } from '@polkadot/rpc-provider'
import { withExpect, setupContext } from '@acala-network/chopsticks-testing';

// Load environment variables
dotenvConfig()

async function main() {
  const api = new ApiPromise({
    provider: new WsProvider('ws://localhost:8000'),
    noInitWarn: true,
  })

  try {
    // Wait for API to be ready
    await api.isReady

    // Get chain info
    const chain = await api.rpc.system.chain()
    console.log('Connected to chain:', chain.toString())

    // Get current block height using header instead of full block
    const header = await api.rpc.chain.getHeader()


    // Use chopsticks-specific dev methods
    try {
        const assethub = await setupContext({
            endpoint: 'wss://asset-hub-polkadot-rpc.n.dwellir.com',
            port: 8000,
            db: './db/assethub.sqlite',
        })

        await assethub.dev.newBlock({ count: 1 });

      console.log('Created new block successfully')
    } catch (error) {
      console.log('Dev methods not available:', error instanceof Error ? error.message : String(error))
    }

    console.log('Hello, world!')
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
  } finally {
    await api.disconnect()
  }
}

main().catch(console.error)