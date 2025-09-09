# Chopsticks + Smoldot: Chain Forking Deep Dive

## What Happens When Chopsticks Forks a Chain

When Chopsticks forks a blockchain, it creates a **local parallel reality** that diverges from the live chain at a specific block. This process relies heavily on Smoldot's core components to ensure execution fidelity.

### The Fork Process Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Chopsticks Fork Process                       │
│                                                                  │
│  Live Chain Timeline:                                            │
│  Block 1000 ──► Block 1001 ──► Block 1002 ──► Block 1003...     │
│                      │                                           │
│                      ▼ Fork Point                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Step 1: Initial Connection                     │ │
│  │                                                             │ │
│  │  ┌─────────────┐    RPC/WS    ┌─────────────┐              │ │
│  │  │ Chopsticks  │◄─────────────┤ Live Chain  │              │ │
│  │  │   Client    │              │   Node      │              │ │
│  │  │             │              │             │              │ │
│  │  │ • Config    │              │ • Block     │              │ │
│  │  │ • Endpoint  │              │ • State     │              │ │
│  │  │ • Fork Block│              │ • Runtime   │              │ │
│  │  └─────────────┘              └─────────────┘              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                      │                                           │
│                      ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Step 2: State & Runtime Download                  │ │
│  │                                                             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │ │
│  │  │   Block     │    │   State     │    │   Runtime   │     │ │
│  │  │ Header/Body │    │   Proofs    │    │ WASM Blob   │     │ │
│  │  │             │    │             │    │             │     │ │
│  │  │ • Hash      │    │ • Merkle    │    │ • :code     │     │ │
│  │  │ • Number    │    │ • Storage   │    │ • Version   │     │ │
│  │  │ • StateRoot │    │ • Trie      │    │ • Metadata  │     │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                      │                                           │
│                      ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │        Step 3: Smoldot Runtime Initialization              │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │               WASM Processing                           │ │
│  │  │                                                         │ │
│  │  │ 1. Decompress Runtime (Zstd if needed)                 │ │
│  │  │ 2. Parse WASM Module                                   │ │
│  │  │ 3. Validate WASM Format                                │ │
│  │  │ 4. Extract Runtime Exports:                            │ │
│  │  │    • Core_version                                      │ │
│  │  │    • Core_execute_block                                │ │
│  │  │    • BlockBuilder_*                                    │ │
│  │  │    • RuntimeApi_*                                      │ │
│  │  │ 5. Setup Host Function Imports                         │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  │                           │                               │ │
│  │                           ▼                               │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │             VM Instantiation                           │ │
│  │  │                                                         │ │
│  │  │  ┌─────────────┐    ┌─────────────┐                   │ │
│  │  │  │   Wasmi     │    │    Host     │                   │ │
│  │  │  │ Interpreter │◄──►│ Functions   │                   │ │
│  │  │  │             │    │             │                   │ │
│  │  │  │ • Memory    │    │ • Storage   │                   │ │
│  │  │  │ • Stack     │    │ • Crypto    │                   │ │
│  │  │  │ • Execution │    │ • Hashing   │                   │ │
│  │  │  └─────────────┘    └─────────────┘                   │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  │  │             Runtime Call Testing                       │ │
│  │  │                                                         │ │
│  │  │ Test Call: Core_version()                              │ │
│  │  │ ├─ Verify: spec_name, spec_version, apis              │ │
│  │  │ └─ Confirm: Runtime is functional                      │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  └─────────────────────────────────────────────────────────────┘ │
│                      │                                           │
│                      ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │          Step 4: Local Chain Initialization                │ │
│  │                                                             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │ │
│  │  │   SQLite    │    │   Memory    │    │   RPC       │     │ │
│  │  │  Database   │    │   Cache     │    │  Server     │     │ │
│  │  │             │    │             │    │             │     │ │
│  │  │ • Blocks    │    │ • Storage   │    │ • ws://8000 │     │ │
│  │  │ • State     │    │ • Trie      │    │ • JSON-RPC  │     │ │
│  │  │ • Metadata  │    │ • Override  │    │ • Substrate │     │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Parallel Reality Begins:                                       │
│  Block 1001'──► Block 1002'──► Block 1003'... (Local)          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Specific Smoldot Components Used by Chopsticks

### 1. **Core Execution Engine** (`smoldot::executor`)

**What Chopsticks Uses:**

```rust
use smoldot::{
    executor::{
        host::{Config, HeapPages, HostVmPrototype, LogEmitInfo},
        runtime_call::{self, OffchainContext, RuntimeCall},
        storage_diff::TrieDiff,
        CoreVersionRef,
    },
};
```

**Purpose:**

- **HostVmPrototype**: Creates the WASM virtual machine instance
- **RuntimeCall**: Executes runtime functions like `Core_execute_block`
- **TrieDiff**: Tracks storage changes between blocks
- **CoreVersionRef**: Extracts runtime version information

**How It Works:**

```
┌──────────────────────────────────────────────────────────────────┐
│                Smoldot Executor in Chopsticks                    │
│                                                                  │
│  User Transaction                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Chopsticks RPC Layer                           │ │
│  │                                                             │ │
│  │ • author_submitExtrinsic                                   │ │
│  │ • state_call                                               │ │
│  │ • chain_getBlock                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Task Orchestration                          │ │
│  │                 (executor/src/task.rs)                     │ │
│  │                                                             │ │
│  │  TaskCall {                                                │ │
│  │    wasm: HexString,           // Runtime WASM blob         │ │
│  │    calls: Vec<(String, Vec<HexString>)>, // Runtime calls  │ │
│  │    mock_signature_host: bool, // For testing               │ │
│  │    ...                                                     │ │
│  │  }                                                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Smoldot VM Execution                           │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │               VM Setup                                  │ │
│  │  │                                                         │ │
│  │  │ let vm = HostVmPrototype::new(Config {                 │ │
│  │  │     module: &wasm_blob,                                │ │
│  │  │     heap_pages: HeapPages::from(1024),                │ │
│  │  │     exec_hint: ExecHint::ValidateAndExecuteOnce,       │ │
│  │  │     allow_unresolved_imports: false,                   │ │
│  │  │ })?;                                                   │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  │                           │                               │ │
│  │                           ▼                               │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │            Runtime Call Execution                      │ │
│  │  │                                                         │ │
│  │  │ let mut runtime_call = RuntimeCall::new(vm);           │ │
│  │  │                                                         │ │
│  │  │ for (function, parameters) in calls {                  │ │
│  │  │     let result = runtime_call.call(                    │ │
│  │  │         &function,                                      │ │
│  │  │         parameters,                                     │ │
│  │  │         OffchainContext::Disabled                       │ │
│  │  │     )?;                                                 │ │
│  │  │ }                                                       │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  │                           │                               │ │
│  │                           ▼                               │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │            Result Processing                           │ │
│  │  │                                                         │ │
│  │  │ CallResponse {                                         │ │
│  │  │     result: HexString,        // Encoded result       │ │
│  │  │     storage_diff: TrieDiff,   // State changes        │ │
│  │  │     logs: Vec<LogInfo>,       // Runtime logs         │ │
│  │  │ }                                                      │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2. **Trie and Proof System** (`smoldot::trie`)

**What Chopsticks Uses:**

```rust
use smoldot::{
    trie::{
        bytes_to_nibbles, nibbles_to_bytes_suffix_extend,
        proof_decode::{decode_and_verify_proof, Config, StorageValue},
        proof_encode::ProofBuilder,
        calculate_root::{root_merkle_value, RootMerkleValueCalculation},
        HashFunction, TrieEntryVersion,
    },
};
```

**Purpose:**

- **Proof Verification**: Validate storage proofs from live chain
- **Trie Construction**: Build local state tries
- **Storage Diff**: Track changes between blocks
- **Root Calculation**: Compute state roots

**Storage Proof Flow:**

```
┌──────────────────────────────────────────────────────────────────┐
│                  Storage Proof Processing                        │
│                                                                  │
│  Live Chain                           Chopsticks                 │
│      │                                    │                      │
│      ▼                                    ▼                      │
│  ┌─────────────┐   Storage Proof    ┌─────────────┐              │
│  │   Full      │───────────────────►│ Smoldot     │              │
│  │   Node      │                    │ Proof       │              │
│  │             │                    │ Decoder     │              │
│  │ • Complete  │                    │             │              │
│  │   State     │                    │ • Verify    │              │
│  │ • Merkle    │                    │   Crypto    │              │
│  │   Tree      │                    │ • Extract   │              │
│  └─────────────┘                    │   Values    │              │
│                                     └─────────────┘              │
│                                           │                      │
│                                           ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            decode_and_verify_proof()                        │ │
│  │                                                             │ │
│  │ 1. Parse encoded proof bytes                               │ │
│  │ 2. Reconstruct trie structure                              │ │
│  │ 3. Verify Merkle paths                                     │ │
│  │ 4. Validate against state root                             │ │
│  │ 5. Extract storage key-value pairs                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                           │                      │
│                                           ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Verified Storage Data                          │ │
│  │                                                             │ │
│  │ Vec<(key: HexString, value: HexString)>                    │ │
│  │                                                             │ │
│  │ • Cryptographically guaranteed to be correct               │ │
│  │ • Can be trusted as authentic chain state                  │ │
│  │ • Forms basis for local execution                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 3. **JSON-RPC Infrastructure** (`smoldot::json_rpc`)

**What Chopsticks Uses:**

```rust
use smoldot::{
    json_rpc::methods::{HashHexString, HexString},
};
```

**Purpose:**

- **Data Encoding**: Consistent hex string formatting
- **Type Safety**: Strongly typed hash and hex values
- **RPC Compatibility**: Standard Substrate RPC format

## Why Smoldot is the Perfect Solution for Chopsticks

### 1. **Execution Fidelity**

**The Problem:** Development tools often use simplified or mock execution environments that don't match production behavior.

**Smoldot's Solution:**

```
┌──────────────────────────────────────────────────────────────────┐
│                    Execution Fidelity                           │
│                                                                  │
│  Production Chain              Chopsticks + Smoldot             │
│                                                                  │
│  ┌─────────────┐               ┌─────────────┐                  │
│  │   Runtime   │               │   Runtime   │                  │
│  │ WASM Blob   │───Identical──►│ WASM Blob   │                  │
│  │             │               │             │                  │
│  │ • Same Code │               │ • Same Code │                  │
│  │ • Same STF  │               │ • Same STF  │                  │
│  │ • Same APIs │               │ • Same APIs │                  │
│  └─────────────┘               └─────────────┘                  │
│         │                               │                       │
│         ▼                               ▼                       │
│  ┌─────────────┐               ┌─────────────┐                  │
│  │ Substrate   │               │   Smoldot   │                  │
│  │   Native    │               │ WASM Engine │                  │
│  │ or Wasmtime │               │             │                  │
│  │             │               │ • Same Host │                  │
│  │ • Host Fns  │               │   Functions │                  │
│  │ • Memory    │               │ • Same Mem  │                  │
│  │ • Execution │               │   Model     │                  │
│  └─────────────┘               └─────────────┘                  │
│         │                               │                       │
│         ▼                               ▼                       │
│  ┌─────────────┐               ┌─────────────┐                  │
│  │   Result    │───Identical──►│   Result    │                  │
│  │             │               │             │                  │
│  │ • State Δ   │               │ • State Δ   │                  │
│  │ • Events    │               │ • Events    │                  │
│  │ • Logs      │               │ • Logs      │                  │
│  └─────────────┘               └─────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key Benefits:**

- **Bug Detection**: Catches issues that would only appear in production
- **Realistic Testing**: Exact same execution environment as live chains
- **State Transition Accuracy**: Perfect reproduction of runtime logic

### 2. **Resource Efficiency**

**The Problem:** Full Substrate nodes require enormous resources for development.

**Smoldot's Solution:**

| Resource       | Full Node          | Smoldot           | Chopsticks Benefit            |
| -------------- | ------------------ | ----------------- | ----------------------------- |
| **Storage**    | 100GB-1TB          | None              | Fast setup, no disk space     |
| **Memory**     | 4-16GB             | 50-200MB          | Runs on developer laptops     |
| **Network**    | Full P2P sync      | Light proofs only | Quick sync, low bandwidth     |
| **CPU**        | Consensus overhead | Execution only    | Focus on development tasks    |
| **Setup Time** | Hours to days      | Seconds           | Instant development iteration |

### 3. **Cross-Platform Compatibility**

**The Problem:** Blockchain development tools are often platform-specific or require complex setups.

**Smoldot's Solution:**

```
┌──────────────────────────────────────────────────────────────────┐
│                  Universal Deployment                           │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Desktop   │    │   Browser   │    │   Mobile    │          │
│  │             │    │             │    │             │          │
│  │ • Windows   │    │ • Chrome    │    │ • iOS       │          │
│  │ • macOS     │    │ • Firefox   │    │ • Android   │          │
│  │ • Linux     │    │ • Safari    │    │ • React Nat │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    WASM Runtime                             │ │
│  │                                                             │ │
│  │ • Universal execution environment                           │ │
│  │ • No platform-specific dependencies                        │ │
│  │ • Same behavior everywhere                                  │ │
│  │ • Easy distribution and deployment                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 4. **Developer Experience Focus**

**The Problem:** Full nodes prioritize network operation over developer needs.

**Smoldot's Chopsticks Optimization:**

```
┌──────────────────────────────────────────────────────────────────┐
│                Developer-Centric Design                         │
│                                                                  │
│  Full Node Priorities          Smoldot + Chopsticks Priorities  │
│                                                                  │
│  ┌─────────────┐               ┌─────────────┐                  │
│  │ Network     │               │ Execution   │                  │
│  │ Consensus   │               │ Accuracy    │                  │
│  │ Security    │               │             │                  │
│  │ Reliability │               │ • Perfect   │                  │
│  │ Scale       │               │   Runtime   │                  │
│  │             │               │ • Fast      │                  │
│  │ 🔴 Complex   │               │ • Simple    │                  │
│  │ 🔴 Resource  │               │             │                  │
│  │ 🔴 Slow      │               │ 🟢 Light    │                  │
│  └─────────────┘               └─────────────┘                  │
│         │                               │                       │
│         ▼                               ▼                       │
│  ┌─────────────┐               ┌─────────────┐                  │
│  │ Production  │               │ Development │                  │
│  │ Validator   │               │ Environment │                  │
│  │             │               │             │                  │
│  │ • Uptime    │               │ • Fast Iter │                  │
│  │ • Security  │               │ • Easy Test │                  │
│  │ • Penalties │               │ • Debug     │                  │
│  │             │               │ • Experiment│                  │
│  │ 🎯 Live Net  │               │             │                  │
│  │             │               │ 🎯 Dev Tools │                  │
│  └─────────────┘               └─────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

## The Perfect Match: Why Chopsticks + Smoldot Works

### **Complementary Strengths**

1. **Chopsticks Provides:**
   - Developer tooling and workflow
   - Storage management and caching
   - RPC interface and compatibility
   - Block building and transaction handling
   - XCM simulation and multi-chain testing

2. **Smoldot Provides:**
   - Accurate runtime execution
   - Cryptographic verification
   - WASM virtual machine
   - Proof handling and validation
   - Cross-platform compatibility

### **Shared Philosophy**

Both projects prioritize:

- **Lightweight over Heavy**: Minimal resource usage
- **Accurate over Approximate**: Correct execution behavior
- **Simple over Complex**: Easy developer adoption
- **Universal over Specific**: Cross-platform compatibility

### **The Result**

Chopsticks + Smoldot creates a development environment that is:

✅ **Realistic**: Uses actual chain runtimes and execution logic  
✅ **Fast**: Instant setup and rapid iteration  
✅ **Accessible**: Runs anywhere, no infrastructure required  
✅ **Reliable**: Cryptographically verified state and proofs  
✅ **Comprehensive**: Full blockchain simulation for testing

This combination gives developers **production-level accuracy** with **development-level convenience** - the best of both worlds for building and testing Substrate-based applications.
