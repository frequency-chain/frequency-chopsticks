# Smoldot Deep Dive: Architecture and Internals

## Overview

Smoldot is a lightweight alternative client for Substrate-based blockchains, designed specifically for environments where full nodes are impractical. It provides the essential functionality needed to interact with blockchains while maintaining a minimal footprint suitable for browsers, mobile apps, and embedded systems.

## Core Components Architecture

### 1. Multi-Component Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        Smoldot Ecosystem                       │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  smoldot-light  │  │     smoldot     │  │smoldot-full-node│ │
│  │      -js        │  │      (lib)      │  │   (prototype)   │ │
│  │                 │  │                 │  │                 │ │
│  │ • WASM Client   │  │ • Rust Primitiv │  │ • Full Node     │ │
│  │ • Browser/Node  │  │ • Core Logic    │  │ • Work in Prog  │ │
│  │ • JS/TS API     │  │ • Unopinionated │  │ • CLI Binary    │ │
│  │ • Main Focus    │  │ • Building Block│  │ • Experimental  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│         │                       ▲                       ▲      │
│         └───────────────────────┼───────────────────────┘      │
│                                 │                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              smoldot-light (Rust base)                 │   │
│  │                                                         │   │
│  │ • Platform-agnostic light client library               │   │
│  │ • Foundation for smoldot-light-js                      │   │
│  │ • Semi-stable API                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Internal Module Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Smoldot Core (lib/src/)                      │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Network   │  │   Executor  │  │    Chain    │              │
│  │             │  │             │  │             │              │
│  │ • libp2p    │  │ • WASM VM   │  │ • Blocks    │              │
│  │ • Protocols │  │ • Runtime   │  │ • Finality  │              │
│  │ • Codec     │  │ • Host Fns  │  │ • Fork Tree │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Sync     │  │    Trie     │  │ Transactions│              │
│  │             │  │             │  │             │              │
│  │ • All Forks │  │ • Merkle    │  │ • Pool      │              │
│  │ • Warp Sync │  │ • Proofs    │  │ • Validate  │              │
│  │ • Parachain │  │ • Storage   │  │ • Light Pool│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Header    │  │  JSON-RPC   │  │   Verify    │              │
│  │             │  │             │  │             │              │
│  │ • BABE      │  │ • Methods   │  │ • AURA      │              │
│  │ • GRANDPA   │  │ • Service   │  │ • BABE      │              │
│  │ • AURA      │  │ • Parser    │  │ • Inherents │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

## Deep Dive: WASM Execution Engine

### Virtual Machine Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   Smoldot WASM Execution Flow                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Live Substrate Chain                        │ │
│  │                                                             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │ │
│  │  │   Runtime   │    │   Storage   │    │   Metadata  │     │ │
│  │  │ WASM Blob   │    │   Proofs    │    │ & Version   │     │ │
│  │  │ (Zstd compressed)│            │    │             │     │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Smoldot Light Client                           │ │
│  │                                                             │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │            WASM Runtime Loader                          │ │
│  │  │                                                         │ │
│  │  │ 1. Download Runtime Blob via Storage Proof             │ │
│  │  │    • Verify cryptographic proof                        │ │
│  │  │    • Decompress Zstd if needed                         │ │
│  │  │                                                         │ │
│  │  │ 2. Parse WASM Module                                    │ │
│  │  │    • Validate WASM format                              │ │
│  │  │    • Extract exports (runtime calls)                   │ │
│  │  │    • Identify imports (host functions)                 │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  │                           │                               │ │
│  │                           ▼                               │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │             Virtual Machine Engine                     │ │
│  │  │                                                         │ │
│  │  │  ┌─────────────┐    ┌─────────────┐                   │ │
│  │  │  │ Interpreter │    │ JIT Compiler│                   │ │
│  │  │  │   (wasmi)   │    │ (wasmtime)  │                   │ │
│  │  │  │             │    │  (optional) │                   │ │
│  │  │  │ • Safe      │    │ • Fast      │                   │ │
│  │  │  │ • Slow      │    │ • Complex   │                   │ │
│  │  │  │ • Universal │    │ • Platform  │                   │ │
│  │  │  └─────────────┘    └─────────────┘                   │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  │                           │                               │ │
│  │                           ▼                               │ │
│  │  ┌─────────────────────────────────────────────────────────┤ │
│  │  │              Host Functions Interface                  │ │
│  │  │                                                         │ │
│  │  │ • ext_storage_get       • ext_crypto_secp256k1_*       │ │
│  │  │ • ext_storage_set       • ext_crypto_sr25519_*         │ │
│  │  │ • ext_storage_root      • ext_crypto_ed25519_*         │ │
│  │  │ • ext_hashing_*         • ext_misc_*                   │ │
│  │  │ • ext_trie_*            • ext_allocator_*              │ │
│  │  └─────────────────────────────────────────────────────────┤ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Runtime Call Results                     │ │
│  │                                                             │ │
│  │ • State Root Hash      • Storage Changes                   │ │
│  │ • Extrinsic Results    • Event Logs                        │ │
│  │ • Runtime Version      • Metadata Updates                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Runtime Call Lifecycle

```
User Transaction/Query
         │
         ▼
┌─────────────────┐
│   JSON-RPC      │    ┌─────────────────┐
│   Request       │───►│  Method Router  │
│                 │    │                 │
│ • state_call    │    │ • Validate      │
│ • author_submit │    │ • Route         │
│ • chain_getBlock│    │ • Transform     │
└─────────────────┘    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │ Runtime Call    │
                    │ Preparation     │
                    │                 │
                    │ • Encode args   │
                    │ • Setup memory  │
                    │ • Prepare state │
                    └─────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    WASM VM Execution                         │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Memory    │    │   Stack     │    │ Host Calls  │      │
│  │  Manager    │◄──►│  Manager    │◄──►│  Handler    │      │
│  │             │    │             │    │             │      │
│  │ • Allocate  │    │ • Call      │    │ • Storage   │      │
│  │ • Deallocate│    │ • Return    │    │ • Crypto    │      │
│  │ • Track     │    │ • Exception │    │ • Trie      │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Runtime Function Execution                  │ │
│  │                                                          │ │
│  │ Core_version()           ┌─ Core_execute_block()         │ │
│  │ Metadata_metadata()      │  BlockBuilder_apply_extrinsic()│ │
│  │ RuntimeApi_impl_*()      │  TaggedTransactionQueue_*()   │ │
│  │                         │                               │ │
│  │ ┌──────────────────────────────────────────────────────┐ │ │
│  │ │           State Transition Function (STF)            │ │ │
│  │ │                                                      │ │ │
│  │ │  new_state = f(old_state, extrinsics, inherents)    │ │ │
│  │ │                                                      │ │ │
│  │ │ • Validate transactions                              │ │ │
│  │ │ • Execute pallet logic                              │ │ │
│  │ │ • Update storage                                     │ │ │
│  │ │ • Emit events                                        │ │ │
│  │ │ • Calculate new state root                          │ │ │
│  │ └──────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │  Result         │
                    │  Processing     │
                    │                 │
                    │ • Decode output │
                    │ • Extract logs  │
                    │ • Update cache  │
                    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │   Response      │
                    │   Formation     │
                    │                 │
                    │ • JSON format   │
                    │ • Error handle  │
                    │ • Send to user  │
                    └─────────────────┘
```

## Consensus Algorithm Support

### Supported Consensus Mechanisms

```
┌──────────────────────────────────────────────────────────────────┐
│                 Smoldot Consensus Support                        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      BABE                                   │ │
│  │           (Blind Assignment for Blockchain Extension)       │ │
│  │                                                             │ │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │ │    Epoch    │  │    Slot     │  │   Block     │          │ │
│  │ │ Management  │  │ Validation  │  │ Production  │          │ │
│  │ │             │  │             │  │             │          │ │
│  │ │ • Duration  │  │ • VRF Check │  │ • Primary   │          │ │
│  │ │ • Authority │  │ • Authority │  │ • Secondary │          │ │
│  │ │ • Randomness│  │ • Threshold │  │ • Fallback  │          │ │
│  │ └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     GRANDPA                                 │ │
│  │           (GHOST-based Recursive Ancestor Deriving         │ │
│  │                 Prefix Agreement)                          │ │
│  │                                                             │ │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │ │  Finality   │  │   Voting    │  │    Commit   │          │ │
│  │ │ Detection   │  │   Process   │  │ Verification│          │ │
│  │ │             │  │             │  │             │          │ │
│  │ │ • Round     │  │ • Prevote   │  │ • 2/3+ Rule │          │ │
│  │ │ • Validator │  │ • Precommit │  │ • Chain     │          │ │
│  │ │ • Authority │  │ • Signature │  │ • Safety    │          │ │
│  │ └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      AURA                                   │ │
│  │              (Authority Round)                              │ │
│  │                                                             │ │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │ │   Round     │  │ Authority   │  │   Block     │          │ │
│  │ │  Robin      │  │   List      │  │ Validation  │          │ │
│  │ │             │  │             │  │             │          │ │
│  │ │ • Slot Time │  │ • Rotation  │  │ • Signature │          │ │
│  │ │ • Duration  │  │ • Selection │  │ • Timing    │          │ │
│  │ │ • Authority │  │ • Identity  │  │ • Authority │          │ │
│  │ └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Network Layer Architecture

### libp2p Integration

```
┌──────────────────────────────────────────────────────────────────┐
│                    Smoldot Network Stack                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Application Layer                         │ │
│  │                                                             │ │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │ │   Sync      │  │    RPC      │  │ Transaction │          │ │
│  │ │  Protocol   │  │  Requests   │  │   Gossip    │          │ │
│  │ │             │  │             │  │             │          │ │
│  │ │ • Block Req │  │ • State Req │  │ • Pool      │          │ │
│  │ │ • Warp Sync │  │ • Call Proof│  │ • Broadcast │          │ │
│  │ │ • Grandpa   │  │ • Storage   │  │ • Validate  │          │ │
│  │ └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Protocol Layer                             │ │
│  │                                                             │ │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │ │  Multistream│  │   Yamux     │  │    Noise    │          │ │
│  │ │   Select    │  │ Multiplexer │  │   Crypto    │          │ │
│  │ │             │  │             │  │             │          │ │
│  │ │ • Negotiate │  │ • Streams   │  │ • Handshake │          │ │
│  │ │ • Version   │  │ • Flow Ctrl │  │ • Encryption│          │ │
│  │ │ • Fallback  │  │ • Backpress │  │ • Identity  │          │ │
│  │ └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Transport Layer                             │ │
│  │                                                             │ │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │ │  WebSocket  │  │    TCP      │  │   WebRTC    │          │ │
│  │ │             │  │             │  │             │          │ │
│  │ │ • Browser   │  │ • Native    │  │ • P2P       │          │ │
│  │ │ • Proxy     │  │ • Direct    │  │ • NAT       │          │ │
│  │ │ • Secure    │  │ • Fast      │  │ • Firewall  │          │ │
│  │ └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Peer Discovery and Management

```
┌──────────────────────────────────────────────────────────────────┐
│                     Peer Management Flow                         │
│                                                                  │
│  Bootstrap Nodes                                                 │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │    Kademlia     │───►│   Peer Store    │                     │
│  │      DHT        │    │                 │                     │
│  │                 │    │ • Addresses     │                     │
│  │ • Find Nodes    │    │ • Reputation    │                     │
│  │ • Find Content  │    │ • Capabilities  │                     │
│  │ • Store Records │    │ • Connection    │                     │
│  └─────────────────┘    └─────────────────┘                     │
│         │                        │                              │
│         └────────────────────────┼────────────────────────┐     │
│                                  │                        │     │
│                                  ▼                        │     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Connection Manager                        │   │
│  │                                                         │   │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │ │ Connection  │  │ Connection  │  │ Connection  │       │   │
│  │ │ Establish   │  │ Maintain    │  │ Cleanup     │       │   │
│  │ │             │  │             │  │             │       │   │
│  │ │ • Handshake │  │ • Health    │  │ • Timeout   │       │   │
│  │ │ • Auth      │  │ • Ping/Pong │  │ • Error     │       │   │
│  │ │ • Upgrade   │  │ • Traffic   │  │ • Shutdown  │       │   │
│  │ └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                  │                        │     │
│                                  ▼                        │     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Protocol Selection                        │   │
│  │                                                         │   │
│  │ /ipfs/ping/1.0.0                                       │   │
│  │ /ipfs/id/1.0.0                                         │   │
│  │ /<genesis_hash>/sync/2                                 │   │
│  │ /<genesis_hash>/light/2                                │   │
│  │ /<genesis_hash>/kad                                    │   │
│  │ /<genesis_hash>/transactions/1                         │   │
│  │ /<genesis_hash>/block-announces/1                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Synchronization Strategies

### Light Client Sync Methods

```
┌──────────────────────────────────────────────────────────────────┐
│                  Smoldot Sync Strategies                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Warp Sync                                │ │
│  │              (Fast Initial Sync)                           │ │
│  │                                                             │ │
│  │  Genesis ──────► Checkpoint ──────► Latest                 │ │
│  │     │                │                 │                   │ │
│  │     ▼                ▼                 ▼                   │ │
│  │ ┌─────────┐    ┌─────────┐       ┌─────────┐              │ │
│  │ │Authority│    │ Finality│       │ Current │              │ │
│  │ │  Set    │    │ Proof   │       │  Head   │              │ │
│  │ │         │    │         │       │         │              │ │
│  │ │ • GRAND │    │ • GRAND │       │ • Block │              │ │
│  │ │   PA    │    │   PA    │       │ • State │              │ │
│  │ │ • BABE  │    │ • Commit│       │ • Peers │              │ │
│  │ └─────────┘    └─────────┘       └─────────┘              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  All Forks Sync                             │ │
│  │                (Normal Operation)                          │ │
│  │                                                             │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │ │
│  │  │   Chain     │    │   Pending   │    │   Verify    │     │ │
│  │  │   Head      │    │   Blocks    │    │ & Execute   │     │ │
│  │  │             │    │             │    │             │     │ │
│  │  │ • Best      │───►│ • Queue     │───►│ • Headers   │     │ │
│  │  │ • Finalized │    │ • Priority  │    │ • Bodies    │     │ │
│  │  │ • Fork Tree │    │ • Ordering  │    │ • Import    │     │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Parachain Sync                              │ │
│  │              (Relay Chain Aware)                           │ │
│  │                                                             │ │
│  │ ┌─────────────┐                        ┌─────────────┐     │ │
│  │ │ Relay Chain │                        │ Parachain   │     │ │
│  │ │    Sync     │ ────Inclusion Proof──► │    Sync     │     │ │
│  │ │             │                        │             │     │ │
│  │ │ • Finality  │                        │ • Para      │     │ │
│  │ │ • Validator │                        │   Blocks    │     │ │
│  │ │ • Authority │                        │ • Validation│     │ │
│  │ └─────────────┘                        └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Light Client vs Full Node Comparison

### Capabilities Matrix

```
┌──────────────────────────────────────────────────────────────────┐
│                   Feature Comparison                             │
│                                                                  │
│ ┌─────────────────┬─────────────────┬─────────────────┬─────────┐ │
│ │     Feature     │   Full Node     │   Light Client  │ Smoldot │ │
│ ├─────────────────┼─────────────────┼─────────────────┼─────────┤ │
│ │ Block Storage   │ ✅ Complete      │ ❌ None         │ ❌ None  │ │
│ │ State Storage   │ ✅ Complete      │ ❌ None         │ ❌ None  │ │
│ │ Runtime Execute │ ✅ Native+WASM   │ ✅ WASM Only    │ ✅ WASM  │ │
│ │ Network Sync    │ ✅ Full P2P      │ ✅ Light P2P    │ ✅ Light │ │
│ │ Transaction Pool│ ✅ Full Pool     │ ✅ Light Pool   │ ✅ Light │ │
│ │ Consensus Part. │ ✅ Validator     │ ❌ Observer     │ ❌ Observ│ │
│ │ Finality Proof  │ ✅ Participant   │ ✅ Verify Only  │ ✅ Verify│ │
│ │ Historical Data │ ✅ Archive       │ ❌ None         │ ❌ None  │ │
│ │ State Queries   │ ✅ Direct        │ ✅ Via Proofs   │ ✅ Proofs│ │
│ │ Resource Usage  │ 🔴 High          │ 🟢 Low          │ 🟢 Low   │ │
│ │ Setup Time      │ 🔴 Hours         │ 🟢 Seconds      │ 🟢 Second│ │
│ │ Browser Support │ ❌ No            │ ✅ Yes          │ ✅ Yes   │ │
│ │ Mobile Support  │ ❌ No            │ ✅ Yes          │ ✅ Yes   │ │
│ │ Trust Model     │ 🟢 Trustless     │ 🟡 Semi-Trust   │ 🟡 Semi  │ │
│ └─────────────────┴─────────────────┴─────────────────┴─────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Performance Characteristics

```
┌──────────────────────────────────────────────────────────────────┐
│                    Performance Profile                           │
│                                                                  │
│  Memory Usage (MB)                                               │
│                                                                  │
│  1000 ┼                                                          │
│       │                                                          │
│   800 ┼                                                          │
│       │ ████████████ Full Node                                   │
│   600 ┼ ████████████                                             │
│       │ ████████████                                             │
│   400 ┼ ████████████                                             │
│       │ ████████████                                             │
│   200 ┼ ████████████                                             │
│       │ ████████████      ██                                     │
│     0 ┼ ████████████      ██    ██ Smoldot                       │
│       └─────────────┬─────────┬─────────────────────────────────  │
│                     │         │                                  │
│                 Storage   Execution                              │
│                                                                  │
│  Network Bandwidth (Mbps)                                       │
│                                                                  │
│   100 ┼                                                          │
│       │ ████████████ Full Node (Sync)                           │
│    80 ┼ ████████████                                             │
│       │ ████████████                                             │
│    60 ┼ ████████████                                             │
│       │ ████████████                                             │
│    40 ┼ ████████████                                             │
│       │ ████████████                                             │
│    20 ┼ ████████████           ████ Smoldot (Warp)              │
│       │ ████████████           ████                              │
│     0 ┼ ████████████      ██   ████   ██ Smoldot (Normal)       │
│       └─────────────┬─────────┬─────────────────────────────────  │
│                     │         │                                  │
│                Initial    Operational                           │
└──────────────────────────────────────────────────────────────────┘
```

## Security Model and Attack Vectors

### Trust and Verification Model

```
┌──────────────────────────────────────────────────────────────────┐
│                   Smoldot Security Model                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Trust Boundaries                           │ │
│  │                                                             │ │
│  │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │ │
│  │ │   Full      │    │   Crypto    │    │   Network   │       │ │
│  │ │   Nodes     │    │ Primitives  │    │ Consensus   │       │ │
│  │ │             │    │             │    │             │       │ │
│  │ │ 🟡 Partially│    │ 🟢 Trusted   │    │ 🟢 Trusted   │       │ │
│  │ │   Trusted   │    │             │    │             │       │ │
│  │ │             │    │ • Ed25519   │    │ • GRANDPA   │       │ │
│  │ │ • Honest    │    │ • Sr25519   │    │ • BABE      │       │ │
│  │ │   Majority  │    │ • Blake2    │    │ • Finality  │       │ │
│  │ │ • Storage   │    │ • Merkle    │    │ • 2/3 Rule  │       │ │
│  │ │   Proofs    │    │   Trees     │    │ • Authority │       │ │
│  │ └─────────────┘    └─────────────┘    └─────────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                   │                             │
│                                   ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Attack Vectors                            │ │
│  │                                                             │ │
│  │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │ │
│  │ │   Eclipse   │    │ Long Range  │    │   Invalid   │       │ │
│  │ │   Attack    │    │   Attack    │    │   Block     │       │ │
│  │ │             │    │             │    │ Propagation │       │ │
│  │ │ 🔴 High Risk │    │ 🟡 Med Risk  │    │ 🟡 Med Risk  │       │ │
│  │ │             │    │             │    │             │       │ │
│  │ │ • Network   │    │ • History   │    │ • Spam      │       │ │
│  │ │   Isolation │    │   Rewrite   │    │ • DoS       │       │ │
│  │ │ • Peer      │    │ • Weak      │    │ • Resource  │       │ │
│  │ │   Control   │    │   Subj.     │    │   Exhaust   │       │ │
│  │ └─────────────┘    └─────────────┘    └─────────────┘       │ │
│  │                                                             │ │
│  │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │ │
│  │ │   Finality  │    │ Nothing at  │    │   State     │       │ │
│  │ │   Stall     │    │   Stake     │    │ Bloat       │       │ │
│  │ │             │    │             │    │             │       │ │
│  │ │ 🟡 Med Risk  │    │ 🟡 Med Risk  │    │ 🟢 Low Risk  │       │ │
│  │ │             │    │             │    │             │       │ │
│  │ │ • Authority │    │ • Light     │    │ • Proof     │       │ │
│  │ │   Failure   │    │   Client    │    │   Size      │       │ │
│  │ │ • Network   │    │ • No Slash  │    │ • Bandwidth │       │ │
│  │ │   Partition │    │ • Social    │    │ • Memory    │       │ │
│  │ └─────────────┘    └─────────────┘    └─────────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Conclusion

Smoldot represents a sophisticated approach to light client architecture that balances:

- **Functionality**: Core blockchain interaction capabilities
- **Performance**: Minimal resource footprint
- **Security**: Cryptographic verification with known trade-offs
- **Portability**: Cross-platform WASM-based execution
- **Usability**: Simple APIs for developers

Its modular design allows it to serve as both a standalone light client and as the execution engine for specialized tools like Chopsticks, demonstrating the power of well-architected blockchain infrastructure components.
