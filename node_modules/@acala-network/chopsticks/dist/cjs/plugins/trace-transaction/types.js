"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "registerTypes", {
    enumerable: true,
    get: function() {
        return registerTypes;
    }
});
const registerTypes = (registry)=>{
    registry.register({
        Step: {
            op: 'u8',
            pc: 'Compact<u32>',
            depth: 'Compact<u32>',
            gas: 'Compact<u64>',
            stack: 'Vec<Bytes>',
            memory: 'Option<Vec<Bytes>>'
        },
        CallType: {
            _enum: {
                CALL: null,
                CALLCODE: null,
                STATICCALL: null,
                DELEGATECALL: null,
                CREATE: null,
                SUICIDE: null
            }
        },
        Log: {
            address: 'H160',
            topics: 'Vec<H256>',
            data: 'Bytes'
        },
        SLoad: {
            address: 'H160',
            index: 'H256',
            value: 'H256'
        },
        SStore: {
            address: 'H160',
            index: 'H256',
            value: 'H256'
        },
        LogTrace: {
            _enum: {
                Log: 'Log',
                SLoad: 'SLoad',
                SStore: 'SStore'
            }
        },
        CallTrace: {
            type: 'CallType',
            from: 'H160',
            to: 'H160',
            input: 'Bytes',
            value: 'U256',
            gas: 'Compact<u64>',
            gasUsed: 'Compact<u64>',
            output: 'Option<Bytes>',
            error: 'Option<String>',
            revertReason: 'Option<String>',
            depth: 'Compact<u32>',
            logs: 'Vec<LogTrace>',
            calls: 'Vec<CallTrace>'
        },
        TraceOutcome: {
            _enum: {
                Calls: 'Vec<CallTrace>',
                Steps: 'Vec<Step>'
            }
        },
        OpcodeConfig: {
            page: 'u32',
            pageSize: 'u32',
            disableStack: 'bool',
            enableMemory: 'bool'
        },
        TracerConfig: {
            _enum: {
                CallTracer: null,
                OpcodeTracer: 'OpcodeConfig'
            }
        }
    });
};
