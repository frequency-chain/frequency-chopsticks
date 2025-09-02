# Smoldot Integration in Chopsticks

## Overview

Smoldot is a lightweight Substrate/Polkadot client written in Rust that serves as the **core execution engine** for Chopsticks. While Chopsticks provides the orchestration, storage, RPC interface, and developer tooling, Smoldot handles the actual blockchain runtime execution in a WASM environment.

## What is Smoldot?

- **Lightweight Substrate Client**: Minimal implementation focused on runtime execution
- **WASM-First Design**: Built to run in browsers, Node.js, and embedded systems
- **No Full Node Overhead**: Provides core blockchain execution without consensus, networking, or storage layers
- **Battle-Tested**: Used in production by Polkadot ecosystem projects

## Smoldot's Role in Chopsticks

### 1. **WASM Runtime Execution** 
Location: `executor/src/lib.rs:4`
- Executes Substrate runtime WASM blobs
- Handles runtime calls and state transitions
- Provides the same execution environment as live chains

### 2. **Proof Generation and Validation**
Location: `executor/src/proof.rs:1` 
- Generates Merkle proofs for storage verification
- Validates storage proofs from live chains
- Ensures state consistency between fork and live chain

### 3. **Core VM Operations**
Location: `executor/src/task.rs:4`
- Block validation and execution through smoldot's VM
- Memory management for WASM execution
- Runtime call orchestration with execution hints

## Architecture Integration

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                         Chopsticks                              │
│                                                                 │
│  ┌─────────────────────┐           ┌─────────────────────┐     │
│  │    TypeScript       │    FFI    │        Rust         │     │
│  │      Core           │◄─────────►│     Executor        │     │
│  │                     │   WASM    │                     │     │
│  │ • RPC Interface     │  Binding  │ ┌─────────────────┐ │     │
│  │ • Storage Layer     │           │ │     Smoldot     │ │     │
│  │ • Block Builder     │           │ │   WASM Engine   │ │     │
│  │ • XCM Router        │           │ │                 │ │     │
│  │ • CLI & Plugins     │           │ │ • Runtime Exec  │ │     │
│  │                     │           │ │ • State STF     │ │     │
│  └─────────────────────┘           │ │ • Proof Gen     │ │     │
│                                    │ │ • VM Management │ │     │
│                                    │ └─────────────────┘ │     │
│                                    └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Component Flow
```
┌──────────────────────────────────────────────────────────────────┐
│                    Chopsticks Execution Flow                     │
│                                                                  │
│  User Transaction                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ RPC Handler │    │Block Builder│    │   Storage   │          │
│  │             │───►│             │◄──►│   Layer     │          │
│  │ • Validate  │    │ • Queue TX  │    │             │          │
│  │ • Queue     │    │ • Inherents │    │ • SQLite    │          │
│  └─────────────┘    │ • Build     │    │ • Cache     │          │
│                     └─────────────┘    │ • Override  │          │
│                             │          └─────────────┘          │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Rust Executor                            │   │
│  │                                                          │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │   │
│  │  │   Task      │    │   Proof     │    │   Smoldot   │  │   │
│  │  │ Orchestrator│───►│ Generator   │───►│ WASM Engine │  │   │
│  │  │             │    │             │    │             │  │   │
│  │  │ • Call Prep │    │ • Merkle    │    │ • Runtime   │  │   │
│  │  │ • Result    │    │ • Storage   │    │ • State STF │  │   │
│  │  │   Handling  │    │ • Validate  │    │ • VM Exec   │  │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│                  ┌─────────────────────┐                        │
│                  │   Execution Result  │                        │
│                  │                     │                        │
│                  │ • New State Root    │                        │
│                  │ • Storage Changes   │                        │
│                  │ • Events & Logs     │                        │
│                  │ • Extrinsic Results │                        │
│                  └─────────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

### Smoldot Integration Points
```
┌─────────────────────────────────────────────────────────────────┐
│                     Smoldot in Chopsticks                      │
│                                                                 │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │   Live Chain    │              │   Chopsticks    │          │
│  │                 │              │                 │          │
│  │ ┌─────────────┐ │              │ ┌─────────────┐ │          │
│  │ │   Runtime   │ │ WASM Blob    │ │   Smoldot   │ │          │
│  │ │    WASM     │ │──────────────┼►│ WASM Engine │ │          │
│  │ │             │ │              │ │             │ │          │
│  │ └─────────────┘ │              │ └─────────────┘ │          │
│  │                 │              │        │        │          │
│  │ ┌─────────────┐ │              │        ▼        │          │
│  │ │   Storage   │ │ State Proof  │ ┌─────────────┐ │          │
│  │ │   Proofs    │ │──────────────┼►│ Proof Verify│ │          │
│  │ │             │ │              │ │             │ │          │
│  │ └─────────────┘ │              │ └─────────────┘ │          │
│  │                 │              │        │        │          │
│  └─────────────────┘              │        ▼        │          │
│                                   │ ┌─────────────┐ │          │
│  User Transactions                │ │   Local     │ │          │
│         │                         │ │  Execution  │ │          │
│         └─────────────────────────┼►│             │ │          │
│                                   │ └─────────────┘ │          │
│                                   └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Implementation Details

### Cargo Dependencies
```toml
# executor/Cargo.toml
[dependencies]
smoldot = { path = '../vendor/smoldot/lib', default-features = false }

[features]
std = ["smoldot/std"]
```

### Git Submodule Structure
```
chopsticks/
├── vendor/
│   └── smoldot/           # Git submodule
│       └── lib/           # Smoldot library crate
└── executor/
    ├── Cargo.toml         # References ../vendor/smoldot/lib
    └── src/
        ├── lib.rs         # Main WASM exports
        ├── task.rs        # Runtime execution tasks
        └── proof.rs       # Storage proof handling
```

### Key Integration Points

#### 1. Runtime Execution (`executor/src/task.rs`)
```rust
use smoldot::{
    executor::vm::ExecHint,
    // ... other imports
};

// Runtime call with execution hint
exec_hint: smoldot::executor::vm::ExecHint::ValidateAndExecuteOnce,
```

#### 2. Proof Generation (`executor/src/proof.rs`)
```rust
use smoldot::{
    trie::TrieEntryVersion,
    // ... other imports
};
```

#### 3. Main Library Interface (`executor/src/lib.rs`)
```rust
use smoldot::{
    json_rpc::methods::{HashHexString, HexString},
    trie::TrieEntryVersion,
};
```

## Benefits of Smoldot Integration

### **Accuracy**
- **Identical Runtime Execution**: Uses the same WASM execution environment as live chains
- **State Transition Fidelity**: Guarantees that local execution matches production behavior
- **Proof Verification**: Ensures forked state is cryptographically valid

### **Performance** 
- **Lightweight**: No full node overhead (consensus, networking, storage)
- **WASM Optimized**: Built specifically for efficient WASM execution
- **Memory Efficient**: Minimal memory footprint for runtime operations

### **Cross-Platform Compatibility**
- **Browser Support**: Runs in web environments via WASM
- **Node.js Compatible**: Works in server environments
- **Embedded Ready**: Can run in resource-constrained environments

### **Developer Experience**
- **Fast Iteration**: Quick runtime execution without blockchain overhead
- **Deterministic**: Consistent execution results across environments
- **Debuggable**: Clear separation between execution and orchestration layers

## Comparison: Chopsticks vs Full Node

| Component | Full Substrate Node | Chopsticks + Smoldot |
|-----------|-------------------|---------------------|
| **Consensus** | Full consensus (BABE/GRANDPA) | Mocked (instant finality) |
| **Networking** | P2P networking stack | None (RPC client only) |
| **Storage** | RocksDB + complex caching | SQLite + simple cache |
| **Runtime Execution** | Smoldot or native | **Smoldot WASM** |
| **RPC Interface** | Full Substrate RPC | Subset + dev extensions |
| **Resource Usage** | High (GB RAM, storage) | Low (MB RAM, storage) |
| **Setup Time** | Minutes to hours | Seconds |
| **Use Case** | Production validator | Development & testing |

## Conclusion

Smoldot serves as the **critical execution core** that makes Chopsticks possible. By leveraging Smoldot's lightweight yet accurate runtime execution capabilities, Chopsticks can provide a realistic blockchain development environment without the complexity and resource requirements of running a full Substrate node.

This architecture allows developers to:
- **Test with confidence** knowing execution matches production
- **Iterate quickly** without blockchain infrastructure overhead  
- **Debug effectively** with clear separation of concerns
- **Deploy anywhere** thanks to WASM portability

The integration demonstrates how modular blockchain architectures enable specialized tools like Chopsticks to focus on developer experience while relying on proven components like Smoldot for core functionality.