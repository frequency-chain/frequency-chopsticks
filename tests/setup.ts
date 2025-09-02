import { config as dotenvConfig } from 'dotenv'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady } from '@polkadot/util-crypto'
import { NetworkContext } from '@acala-network/chopsticks-testing'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
dotenvConfig()

// Setup custom logger to capture all console output
const logFile = path.join(process.cwd(), 'test-output.log')
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
const originalConsoleInfo = console.info

function writeToLog(level: string, ...args: any[]) {
  const timestamp = new Date().toISOString()
  const message = `[${timestamp}] [${level}] ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')}\n`
  
  fs.appendFileSync(logFile, message)
  
  // Also write to original console
  if (level === 'ERROR') {
    originalConsoleError(...args)
  } else if (level === 'WARN') {
    originalConsoleWarn(...args)
  } else if (level === 'INFO') {
    originalConsoleInfo(...args)
  } else {
    originalConsoleLog(...args)
  }
}

console.log = (...args: any[]) => writeToLog('LOG', ...args)
console.error = (...args: any[]) => writeToLog('ERROR', ...args)
console.warn = (...args: any[]) => writeToLog('WARN', ...args)
console.info = (...args: any[]) => writeToLog('INFO', ...args)

console.log('Test setup initialized - logging to test-output.log')

export interface TestChains {
  frequency: ApiPromise
  assetHub: ApiPromise
  relay: ApiPromise
}

export interface TestAccounts {
  alice: any
  bob: any
}

export async function setupTestEnvironment(): Promise<{ chains: TestChains, accounts: TestAccounts }> {
  await cryptoWaitReady()
  
  // Initialize keyring
  const keyring = new Keyring({ type: 'sr25519' })
  const alice = keyring.addFromUri('//Alice')
  const bob = keyring.addFromUri('//Bob')
  
  // Connect to forked chains
  const frequencyProvider = new WsProvider('ws://localhost:8002')
  const assetHubProvider = new WsProvider('ws://localhost:8001')  
  const relayProvider = new WsProvider('ws://localhost:8000')
  
  const frequency = await ApiPromise.create({ provider: frequencyProvider })
  const assetHub = await ApiPromise.create({ provider: assetHubProvider })
  const relay = await ApiPromise.create({ provider: relayProvider })
  
  // Wait for chains to be ready
  await frequency.isReady
  await assetHub.isReady
  await relay.isReady
  
  console.log('Connected to chains:')
  console.log(`- Frequency: ${await frequency.rpc.system.chain()}`)
  console.log(`- AssetHub: ${await assetHub.rpc.system.chain()}`)
  console.log(`- Relay: ${await relay.rpc.system.chain()}`)
  
  return {
    chains: { frequency, assetHub, relay },
    accounts: { alice, bob }
  }
}

export async function cleanupTestEnvironment(chains: TestChains) {
  await chains.frequency.disconnect()
  await chains.assetHub.disconnect()
  await chains.relay.disconnect()
}