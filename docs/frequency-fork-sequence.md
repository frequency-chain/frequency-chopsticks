# Chopsticks Frequency Chain Fork - Sequence Diagram

Based on the analysis of the Chopsticks codebase, here's what happens when forking the Frequency chain using `setupContext`:

```mermaid
sequenceDiagram
    participant User
    participant setupContext as setupContext()
    participant Api as Api/Provider
    participant LiveChain as Live Frequency Chain
    participant setup as Core setup()
    participant Blockchain
    participant SmoldotVM as Smoldot WASM VM
    participant Storage as Storage Layer
    participant Database as SQLite DB

    User->>setupContext: setupContext({ endpoint: 'wss://1.rpc.frequency.xyz' })
    
    Note over setupContext: packages/chopsticks/src/context.ts:37
    setupContext->>setupContext: Parse config (genesis, block, etc.)
    
    setupContext->>setup: setup({ endpoint, block, buildBlockMode, db, ... })
    
    Note over setup: packages/core/src/setup.ts:80
    setup->>setup: processOptions()
    
    setup->>Api: new WsProvider(endpoint, timeout=3000)
    Api->>LiveChain: WebSocket connection
    LiveChain-->>Api: Connection established
    
    setup->>Api: new Api(provider)
    setup->>Api: await api.isReady
    Api->>LiveChain: RPC: system_chain, system_properties, etc.
    LiveChain-->>Api: Chain info (Frequency Network)
    
    alt block not specified
        setup->>Api: getFinalizedHead()
        Api->>LiveChain: RPC: chain_getFinalizedHead
        LiveChain-->>Api: Latest finalized block hash
    else block specified
        setup->>Api: getBlockHash(blockNumber)
        Api->>LiveChain: RPC: chain_getBlockHash
        LiveChain-->>Api: Specific block hash
    end
    
    setup->>Api: getHeader(blockHash)
    Api->>LiveChain: RPC: chain_getHeader
    LiveChain-->>Api: Block header { number, parentHash, stateRoot, ... }
    
    setup->>Blockchain: new Blockchain({ api, header, db, mockSignatureHost, ... })
    
    Note over Blockchain: packages/core/src/blockchain/index.ts
    Blockchain->>Blockchain: constructor() - Initialize TxPool, HeadState
    
    Blockchain->>Api: getRuntime(blockHash)
    Api->>LiveChain: RPC: state_call('Metadata_metadata')
    Api->>LiveChain: RPC: state_getStorage(':code')
    LiveChain-->>Api: Runtime WASM blob + metadata
    
    Blockchain->>SmoldotVM: Initialize WASM executor
    
    Note over SmoldotVM: executor/src/task.rs
    SmoldotVM->>SmoldotVM: Parse WASM blob
    SmoldotVM->>SmoldotVM: Validate WASM format
    SmoldotVM->>SmoldotVM: Extract runtime exports (Core_version, etc.)
    SmoldotVM->>SmoldotVM: Setup host functions (storage, crypto, hashing)
    
    SmoldotVM->>SmoldotVM: Call Core_version()
    SmoldotVM-->>Blockchain: Runtime version { spec_name: 'frequency', spec_version, ... }
    
    Blockchain->>Storage: Initialize storage layer
    Storage->>Database: new SqliteDatabase(dbPath) if specified
    Database-->>Storage: Database connection
    
    Blockchain->>Blockchain: setupHead(header)
    Blockchain->>Api: getStorageAt(keys, blockHash)
    Api->>LiveChain: RPC: state_getStorageAt + storage proofs
    LiveChain-->>Api: Storage data + Merkle proofs
    
    Blockchain->>SmoldotVM: Verify storage proofs using smoldot
    
    Note over SmoldotVM: executor/src/proof.rs - decode_and_verify_proof()
    SmoldotVM->>SmoldotVM: Decode storage proof
    SmoldotVM->>SmoldotVM: Verify Merkle paths against state root
    SmoldotVM->>SmoldotVM: Extract verified key-value pairs
    SmoldotVM-->>Blockchain: Verified storage data
    
    Blockchain->>Storage: Store verified state
    Storage->>Database: INSERT storage entries
    
    opt Resume from database
        setupContext->>Database: queryBlock(resumeHash/Number)
        Database-->>setupContext: Cached block data
        setupContext->>Blockchain: setHead(cachedBlock)
    end
    
    opt WASM override
        setupContext->>Blockchain: overrideWasm(wasmPath)
        Blockchain->>SmoldotVM: Replace runtime with custom WASM
    end
    
    opt Storage override
        setupContext->>Blockchain: overrideStorage(storageFile)
        Blockchain->>Storage: Apply storage overrides
    end
    
    opt Prefetch storages
        setupContext->>setupContext: startFetchStorageWorker()
        setupContext->>LiveChain: Background fetch additional storage
    end
    
    setupContext-->>User: { chain: Blockchain, fetchStorageWorker }
    
    Note over User: Chain is now forked and ready for local development
    Note over User: RPC server can be started at ws://localhost:8000
    Note over User: New blocks can be built with custom transactions
```

## Key Points

1. **Initial Connection**: Creates WebSocket connection to live Frequency chain
2. **Block Selection**: Either uses latest finalized block or specified block number/hash  
3. **Runtime Download**: Fetches the actual Frequency runtime WASM blob from `:code` storage
4. **Smoldot Integration**: Uses smoldot to parse WASM, setup VM, and verify storage proofs
5. **State Verification**: All storage data is cryptographically verified against the state root
6. **Local Setup**: Creates local blockchain instance with verified state and runtime
7. **Database Caching**: Optionally persists state to SQLite for faster subsequent runs

The result is a local fork that executes with **identical runtime logic** to the live Frequency chain, allowing realistic development and testing.