[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

> Caching for Nodejs based on Keyv

[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

`Cacheable` provides a robust, scalable, and maintained set of caching packages that can be used in various projects. The packages in this repository are:

| Package | Downloads | Description |
|---------|-----------|-------------|
| [cacheable](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable) | [![npm](https://img.shields.io/npm/dm/cacheable.svg)](https://www.npmjs.com/package/cacheable) | Next generation caching framework built from the ground up with layer 1 / layer 2 caching. |
| [cache-manager](https://github.com/jaredwray/cacheable/tree/main/packages/cache-manager) | [![npm](https://img.shields.io/npm/dm/cache-manager.svg)](https://www.npmjs.com/package/cache-manager) | Cache Manager that is used in services such as NestJS and others with robust features such as `wrap` and more. |
| [cacheable-request](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable-request) | [![npm](https://img.shields.io/npm/dm/cacheable-request.svg)](https://www.npmjs.com/package/cacheable-request) | Wrap native HTTP requests with RFC compliant cache support |
| [flat-cache](https://github.com/jaredwray/cacheable/tree/main/packages/flat-cache) | [![npm](https://img.shields.io/npm/dm/flat-cache.svg)](https://www.npmjs.com/package/flat-cache) | Fast In-Memory Caching with file store persistence |
| [file-entry-cache](https://github.com/jaredwray/cacheable/tree/main/packages/file-entry-cache) | [![npm](https://img.shields.io/npm/dm/file-entry-cache.svg)](https://www.npmjs.com/package/file-entry-cache) | A lightweight cache for file metadata, ideal for processes that work on a specific set of files and only need to reprocess files that have changed since the last run |
| [@cacheable/node-cache](https://github.com/jaredwray/cacheable/tree/main/packages/node-cache) | [![npm](https://img.shields.io/npm/dm/@cacheable/node-cache.svg)](https://www.npmjs.com/package/@cacheable/node-cache) | Maintained built in replacement of `node-cache` |
| [@cacheable/memory](https://github.com/jaredwray/cacheable/tree/main/packages/memory) | [![npm](https://img.shields.io/npm/dm/@cacheable/memory.svg)](https://www.npmjs.com/package/@cacheable/memory) | In-Memory Caching with LRU support |
| [@cacheable/utils](https://github.com/jaredwray/cacheable/tree/main/packages/utils) | [![npm](https://img.shields.io/npm/dm/@cacheable/utils.svg)](https://www.npmjs.com/package/@cacheable/utils) | Utility functions for cacheable with `hashing`, `shorthand time`, `memoize` and more |

The website documentation for https://cacheable.org is included in this repository [here](https://github.com/jaredwray/cacheable/tree/main/packages/website).

# How to Use the Cacheable Mono Repo

* [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) - Our code of conduct
* [CONTRIBUTING](CONTRIBUTING.md) - How to contribute to this project
* [SECURITY](SECURITY.md) - Security guidelines and supported versions

## Open a Pull Request

Please follow the [CONTRIBUTING](CONTRIBUTING.md) guidelines provided and remember you will need to do setup on this project such as having redis running (via docker), building the project `pnpm build`, and testing `pnpm test` which will also perform linting.

## Post an Issue

To post an issue, navigate to the "Issues" tab in the main repository, and then select "New Issue." Enter a clear title describing the issue, as well as a description containing additional relevant information. Also select the label that best describes your issue type. For a bug report, for example, create an issue with the label "bug." In the description field, Be sure to include replication steps, as well as any relevant error messages.

If you're reporting a security violation, be sure to check out the project's [security policy](https://github.com/jaredwray/cacheable/blob/main/SECURITY.md).

Please also refer to our [Code of Conduct](https://github.com/jaredwray/cacheable/blob/main/CODE_OF_CONDUCT.md) for more information on how to report issues.

## Ask a Question

To ask a question, create an issue with the label "question." In the issue description, include the related code and any context that can help us answer your question.

## License

[MIT © Jared Wray](LICENSE)
