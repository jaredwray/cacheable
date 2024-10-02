// eslint-disable-next-line no-promise-executor-return
export const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
