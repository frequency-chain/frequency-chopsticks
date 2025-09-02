# Chopsticks Architecture Diagrams

## 1. High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Live Chain    │    │   Chopsticks    │    │  Developer      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Block N   │◄┼────┼─│ Fork Point  │ │    │ │ Polkadot.js │ │
│ │   State     │ │    │ │             │ │    │ │   Apps      │ │
│ │   Runtime   │ │    │ │             │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │        │        │    │        │        │
│      WS RPC     │    │        ▼        │    │     WS RPC     │
│                 │    │ ┌─────────────┐ │    │                 │
└─────────────────┘    │ │ Local Fork  │ │◄───┼─────────────────┘
                       │ │   Block N+1 │ │    │
                       │ │   Block N+2 │ │    │
                       │ │     ...     │ │    │
                       │ └─────────────┘ │    │
                       └─────────────────┘    │
                                              │
```

## 2. Internal Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Chopsticks                                │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     CLI     │  │   Plugins   │  │ RPC Methods │              │
│  │             │  │             │  │             │              │
│  │ • run-block │  │ • dry-run   │  │ • substrate │              │
│  │ • xcm       │  │ • try-rt    │  │ • dev       │              │
│  │ • config    │  │ • trace-tx  │  │ • rpc-spec  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Core Engine                          │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │   Storage   │  │    Block    │  │    WASM     │      │   │
│  │  │   Layer     │  │   Builder   │  │  Executor   │      │   │
│  │  │             │  │             │  │             │      │   │
│  │  │ • SQLite DB │  │ • TX Pool   │  │ • Runtime   │      │   │
│  │  │ • Key Cache │  │ • Inherents │  │ • State STF │      │   │
│  │  │ • Override  │  │ • Validation│  │ • Rust/WASM │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Block Production Flow

```
User Submit TX
      │
      ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  RPC Layer  │    │ Block Builder│    │ WASM Executor│
│             │    │             │    │             │
│ • Validate  │───▶│ • Add TX    │───▶│ • Execute   │
│ • Queue TX  │    │ • Inherents │    │ • State STF │
│             │    │ • Build     │    │ • Storage Δ │
└─────────────┘    └─────────────┘    └─────────────┘
      │                    │                    │
      │                    ▼                    │
      │            ┌─────────────┐              │
      │            │   Storage   │◄─────────────┘
      │            │   Layer     │
      │            │             │
      │            │ • Apply Δ   │
      │            │ • Cache     │
      │            │ • Persist   │
      │            └─────────────┘
      │                    │
      ▼                    ▼
┌─────────────────────────────────┐
│         New Block               │
│                                 │
│ • Block Hash                    │
│ • State Root                    │
│ • Extrinsic Results            │
│ • Event Logs                    │
└─────────────────────────────────┘
```

## 4. XCM Multi-Chain Setup

```
┌─────────────────┐                ┌─────────────────┐
│   Relay Chain   │                │   Para Chain A  │
│   (Kusama)      │                │   (Karura)      │
│                 │                │                 │
│ ┌─────────────┐ │  Horizontal    │ ┌─────────────┐ │
│ │  Chopsticks │ │◄──Messages────▶│ │  Chopsticks │ │
│ │   Instance  │ │   (HRMP)       │ │   Instance  │ │
│ │             │ │                │ │             │ │
│ └─────────────┘ │                │ └─────────────┘ │
│       │         │                │       │         │
│    Downward     │                │    Upward       │
│    Messages     │                │    Messages     │
│    (DMP)        │                │    (UMP)        │
│       │         │                │       │         │
│       ▼         │                │       ▲         │
└─────────────────┘                └─────────────────┘
        │                                  │
        └──────────────────────────────────┘
                    Virtual XCM
                   Message Router
                        │
                        ▼
                ┌─────────────────┐
                │   Para Chain B  │
                │   (Statemine)   │
                │                 │
                │ ┌─────────────┐ │
                │ │  Chopsticks │ │
                │ │   Instance  │ │
                │ │             │ │
                │ └─────────────┘ │
                └─────────────────┘
```

## 5. Fork and Resume Process

```
Live Chain Timeline:
Block 1000 ──► Block 1001 ──► Block 1002 ──► Block 1003 ──► ...

                    │ Fork Point
                    ▼
Chopsticks Fork:
               Block 1001'──► Block 1002'──► Block 1003'──► ...
                    │            │            │
                    ▼            ▼            ▼
               ┌─────────┐  ┌─────────┐  ┌─────────┐
               │ SQLite  │  │ SQLite  │  │ SQLite  │
               │   DB    │  │   DB    │  │   DB    │
               │ State   │  │ State   │  │ State   │
               └─────────┘  └─────────┘  └─────────┘
                    ▲
                    │ Resume from saved state
              ┌─────────────┐
              │   --resume  │
              │ <block-num> │
              └─────────────┘
```

## 6. Storage Layer Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Storage Layer                         │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Memory    │  │    Cache    │  │   SQLite    │      │
│  │   Store     │  │   Layer     │  │  Database   │      │
│  │             │  │             │  │             │      │
│  │ • Pending   │◄─┤ • Key-Value │◄─┤ • Blocks    │      │
│  │ • Override  │  │ • LRU Cache │  │ • Storage   │      │
│  │ • Session   │  │ • Diff Log  │  │ • Metadata  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│         ▲                 ▲                 ▲           │
│         │                 │                 │           │
│  ┌──────┴──────────────────┴─────────────────┴─────┐     │
│  │              Storage Query Engine               │     │
│  │                                                 │     │
│  │ • get(key) → value                             │     │
│  │ • set(key, value)                              │     │
│  │ • getKeys(prefix)                              │     │
│  │ • getBatch(keys[])                             │     │
│  └─────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

These diagrams show:
1. **High-level**: How Chopsticks sits between live chains and developers
2. **Components**: Internal architecture with CLI, plugins, core engine
3. **Block Flow**: Step-by-step transaction processing
4. **XCM Setup**: Multi-chain testing configuration  
5. **Fork/Resume**: How state persistence works
6. **Storage**: Layered storage architecture for performance