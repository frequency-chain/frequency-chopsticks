import { ResponseError, allHandlers as coreHandlers, defaultLogger } from '@acala-network/chopsticks-core';
import { getRpcExtensionMethods, loadRpcExtensionMethod } from '../plugins/index.js';
const rpcLogger = defaultLogger.child({
    name: 'rpc'
});
const allHandlers = {
    ...coreHandlers,
    rpc_methods: async ()=>Promise.resolve({
            version: 1,
            methods: [
                ...Object.keys(allHandlers),
                ...getRpcExtensionMethods()
            ].sort()
        })
};
const getHandler = async (method)=>{
    const handler = allHandlers[method];
    if (!handler) {
        // no handler for this method, check if it's a plugin or a script loaded
        return loadRpcExtensionMethod(method);
    }
    return handler;
};
export const handler = (context)=>async ({ method, params }, subscriptionManager)=>{
        rpcLogger.trace('Handling %s', method);
        const handler = await getHandler(method);
        if (!handler) {
            rpcLogger.warn('Method not found %s', method);
            throw new ResponseError(-32601, `Method not found: ${method}`);
        }
        return handler(context, params, subscriptionManager);
    };
