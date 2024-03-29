import process from 'node:process';

// eslint-disable-next-line no-promise-executor-return
export const sleep = async (ms: number) => new Promise(r => setTimeout(r, ms));

export const disableExistingExceptionListeners = () => {
	const uncaughtExceptionListeners = process.rawListeners(
		'uncaughtException',
	) as NodeJS.UncaughtExceptionListener[];
	const unhandledRejectionListeners = process.rawListeners(
		'unhandledRejection',
	) as NodeJS.UnhandledRejectionListener[];

	process.removeAllListeners('uncaughtException');
	process.removeAllListeners('unhandledRejection');

	/* Restore listeners */
	return () => {
		for (const listener of uncaughtExceptionListeners) {
			process.addListener('uncaughtException', listener);
		}

		for (const listener of unhandledRejectionListeners) {
			process.addListener('unhandledRejection', listener);
		}
	};
};
