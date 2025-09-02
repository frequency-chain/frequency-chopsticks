"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "handler", {
    enumerable: true,
    get: function() {
        return handler;
    }
});
const _chopstickscore = require("@acala-network/chopsticks-core");
const _index = require("../plugins/index.js");
const rpcLogger = _chopstickscore.defaultLogger.child({
    name: 'rpc'
});
const allHandlers = {
    ..._chopstickscore.allHandlers,
    rpc_methods: async ()=>Promise.resolve({
            version: 1,
            methods: [
                ...Object.keys(allHandlers),
                ...(0, _index.getRpcExtensionMethods)()
            ].sort()
        })
};
const getHandler = async (method)=>{
    const handler = allHandlers[method];
    if (!handler) {
        // no handler for this method, check if it's a plugin or a script loaded
        return (0, _index.loadRpcExtensionMethod)(method);
    }
    return handler;
};
const handler = (context)=>async ({ method, params }, subscriptionManager)=>{
        rpcLogger.trace('Handling %s', method);
        const handler = await getHandler(method);
        if (!handler) {
            rpcLogger.warn('Method not found %s', method);
            throw new _chopstickscore.ResponseError(-32601, `Method not found: ${method}`);
        }
        return handler(context, params, subscriptionManager);
    };
