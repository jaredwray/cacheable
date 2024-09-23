/* eslint-disable  promise/param-names, no-promise-executor-return  */
export const sleep = async (ms: number) => new Promise(r => setTimeout(r, ms));
