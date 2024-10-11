[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

> Caching for Nodejs based on Keyv

[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![npm](https://img.shields.io/npm/dm/cacheable-request.svg)](https://www.npmjs.com/package/cacheable-request)

With over `1bn downloads` a year the goal with the `Cacheable Project` is to provide a robust, scalable, and maintained set of caching packages that can be used in various projects. The packages in this repository are:

| Package | Version | Downloads | Description |
|-------|---------|---------|---------|
| [cacheable](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable) | [![npm](https://img.shields.io/npm/v/cacheable)](https://www.npmjs.com/package/cacheable) | [![npm](https://img.shields.io/npm/dm/cacheable.svg)](https://www.npmjs.com/package/cacheable) | Next generation caching framework built fron the ground up with layer 1 / layer 2 caching. |
| [cache-manager](https://github.com/jaredwray/cacheable/tree/main/packages/cache-manager) | [![npm](https://img.shields.io/npm/v/cache-manager)](https://www.npmjs.com/package/cache-manager) | [![npm](https://img.shields.io/npm/dm/cache-manager.svg)](https://www.npmjs.com/package/cache-manager) | Cache Manager that is used in services such as NestJS and others with robust features such as `wrap` and more. |
| [cacheable-request](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable-request) | [![npm](https://img.shields.io/npm/v/cacheable-request)](https://www.npmjs.com/package/cacheable-request) | [![npm](https://img.shields.io/npm/dm/cacheable-request.svg)](https://www.npmjs.com/package/cacheable-request) | Wrap native HTTP requests with RFC compliant cache support |
| [flat-cache](https://github.com/jaredwray/cacheable/tree/main/packages/flat-cache) | [![npm](https://img.shields.io/npm/v/flat-cache)](https://www.npmjs.com/package/flat-cache) | [![npm](https://img.shields.io/npm/dm/flat-cache.svg)](https://www.npmjs.com/package/flat-cache) | Fast In-Memory Caching with file store persistence |
| [file-entry-cache](https://github.com/jaredwray/cacheable/tree/main/packages/flat-cache) | [![npm](https://img.shields.io/npm/v/file-entry-cache)](https://www.npmjs.com/package/file-entry-cache) | [![npm](https://img.shields.io/npm/dm/file-entry-cache.svg)](https://www.npmjs.com/package/file-entry-cache) | A lightweight cache for file metadata, ideal for processes that work on a specific set of files and only need to reprocess files that have changed since the last run |
| [@cacheable/node-cache](https://github.com/jaredwray/cacheable/tree/main/packages/node-cache) | [![npm](https://img.shields.io/npm/v/@cacheable/node-cache)](https://www.npmjs.com/package/@cacheable/node-cache) | [![npm](https://img.shields.io/npm/dm/@cacheable/node-cache.svg)](https://www.npmjs.com/package/@cacheable/node-cache) | Maintained built in replacement of `node-cache` |

 The website documentation for https://cacheable.org is included in this repository [here](https://github.com/jaredwray/cacheable/tree/main/packages/website).

# How to Use the Cacheable Mono Repo

* [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) - Our code of conduct
* [CONTRIBUTING](CONTRIBUTING.md) - How to contribute to this project
* [SECURITY](SECURITY.md) - Security guidelines and supported versions

## Open a Pull Request

You can contribute changes to this repo by opening a pull request:

1) After forking this repository to your Git account, make the proposed changes on your forked branch.
2) You will need `docker` installed and running on your machine. Once it is installed run `pnpm test:services:start` to start the services needed for testing.
3) Run tests and linting locally.
	- Run `pnpm i && pnpm test`.
4) Commit your changes and push them to your forked repository.
5) Navigate to the main `cacheable` repository and select the *Pull Requests* tab.
6) Click the *New pull request* button, then select the option "Compare across forks"
7) Leave the base branch set to main. Set the compare branch to your forked branch, and open the pull request.
8) Once your pull request is created, ensure that all checks have passed and that your branch has no conflicts with the base branch. If there are any issues, resolve these changes in your local repository, and then commit and push them to git.
9) Similarly, respond to any reviewer comments or requests for changes by making edits to your local repository and pushing them to Git.
10) Once the pull request has been reviewed, those with write access to the branch will be able to merge your changes into the `cacheable` repository.

If you need more information on the steps to create a pull request, you can find a detailed walkthrough in the [Github documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)

## Post an Issue

To post an issue, navigate to the "Issues" tab in the main repository, and then select "New Issue." Enter a clear title describing the issue, as well as a description containing additional relevant information. Also select the label that best describes your issue type. For a bug report, for example, create an issue with the label "bug." In the description field, Be sure to include replication steps, as well as any relevant error messages.

If you're reporting a security violation, be sure to check out the project's [security policy](https://github.com/jaredwray/cacheable/blob/main/SECURITY.md).

Please also refer to our [Code of Conduct](https://github.com/jaredwray/cacheable/blob/main/CODE_OF_CONDUCT.md) for more information on how to report issues.

## Ask a Question

To ask a question, create an issue with the label "question." In the issue description, include the related code and any context that can help us answer your question.

## License

[MIT © Jared Wray](LICENSE)
