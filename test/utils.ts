import process from 'node:process';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const disableExistingExceptionListeners = () => {
  const uncaughtExceptionListeners = process.rawListeners(
    'uncaughtException',
  ) as NodeJS.UncaughtExceptionListener[];
  const unhandledRejectionListeners = process.rawListeners(
    'unhandledRejection',
  ) as NodeJS.UnhandledRejectionListener[];

  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');

  /* restore listeners */
  return () => {
    uncaughtExceptionListeners.forEach((listener) =>
      process.addListener('uncaughtException', listener),
    );
    unhandledRejectionListeners.forEach((listener) =>
      process.addListener('unhandledRejection', listener),
    );
  };
};
