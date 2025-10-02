import fc from 'fast-check';
import fs from 'fs';
import process from 'process';

let failureId = 0;
export const reportFailure= (inputs: Array<any>, error: Error) {
  const fileName = `failure-pid${process.pid}-${++failureId}.log`;
  const fileContent = `Counterexample: ${fc.stringify(inputs)}\n\nError: ${error}`;
  fs.writeFileSync(fileName, fileContent);
}

export type ArbFunction = (...inputs: Array<any>) => Promise<boolean|void>;

export const  neverFailingPredicate = async (predicate: ArbFunction) {
  return (...inputs: Array<any>) => {
    try {
      const out = await predicate(...inputs);
      if (out === false) {
        reportFailure(inputs, new Error('Arbitrary predicate returned false'));
      }
    } catch (err: Error) {
      reportFailure(inputs, err);
    }
  };
}