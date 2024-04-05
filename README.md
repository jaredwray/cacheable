# Cache Manager

[![codecov](https://codecov.io/gh/jaredwray/cache-manager/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cache-manager)
[![tests](https://github.com/jaredwray/cache-manager/actions/workflows/test.yml/badge.svg)](https://github.com/jaredwray/cache-manager/actions/workflows/test.yml)
[![license](https://img.shields.io/github/license/jaredwray/cache-manager)](https://github.com/jaredwray/cache-manager/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/dm/cache-manager)](https://npmjs.com/package/cache-manager)
![npm](https://img.shields.io/npm/v/cache-manager)

This is the cache manager mono repo that has the following packages:
* `cache-manager` - The core package that provides the cache manager library.
* `cache-manager-redis-yet` - The redis store for cache manager.
* `cache-manager-ioredis-yet` - The ioredis store for cache manager.

## Getting Started

To get started you can visit the [cache-manager](/packages/cache-manager/README.md) package and learn how to use it. In addition here are some other documents:

* [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Our code of conduct
* [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute to this project

## Store Engines

### Official and updated to last version

- [node-cache-manager-redis-yet](https://github.com/jaredwray/cache-manager/packages/cache-manager-redis-yet) (uses [node_redis](https://github.com/NodeRedis/node_redis))

- [node-cache-manager-ioredis-yet](https://github.com/jaredwray/cache-manager/packages/cache-manager-ioredis-yet) (uses [ioredis](https://github.com/luin/ioredis))

### Third party

- [node-cache-manager-redis](https://github.com/dial-once/node-cache-manager-redis) (uses [sol-redis-pool](https://github.com/joshuah/sol-redis-pool))

- [node-cache-manager-redis-store](https://github.com/dabroek/node-cache-manager-redis-store) (uses [node_redis](https://github.com/NodeRedis/node_redis))

- [node-cache-manager-ioredis](https://github.com/Tirke/node-cache-manager-ioredis) (uses [ioredis](https://github.com/luin/ioredis))

- [node-cache-manager-mongodb](https://github.com/v4l3r10/node-cache-manager-mongodb)

- [node-cache-manager-mongoose](https://github.com/disjunction/node-cache-manager-mongoose)

- [node-cache-manager-fs-binary](https://github.com/sheershoff/node-cache-manager-fs-binary)

- [node-cache-manager-fs-hash](https://github.com/rolandstarke/node-cache-manager-fs-hash)

- [node-cache-manager-hazelcast](https://github.com/marudor/node-cache-manager-hazelcast)

- [node-cache-manager-memcached-store](https://github.com/theogravity/node-cache-manager-memcached-store)

- [node-cache-manager-memory-store](https://github.com/theogravity/node-cache-manager-memory-store)

- [node-cache-manager-couchbase](https://github.com/davidepellegatta/node-cache-manager-couchbase)

- [node-cache-manager-sqlite](https://github.com/maxpert/node-cache-manager-sqlite)

- [@resolid/cache-manager-sqlite](https://github.com/huijiewei/cache-manager-sqlite) (uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3))


## Getting Started with the Mono Repo

Start by installing `pnpm` globally:

```bash
npm install -g pnpm
```

Then install the dependencies:

```bash
pnpm install
```

To run the tests:

```bash
pnpm test
```

To build the packages:

```bash
pnpm build
```

## Open a Pull Request

You can contribute changes to this repo by opening a pull request:

1) After forking this repository to your Git account, make the proposed changes on your forked branch.
2) Run tests and linting locally.
	- [Install and run Docker](https://docs.docker.com/get-docker/) if you aren't already.
	- Run `pnpm test:services:start`, allow for the services to come up.
	- Run `pnpm test`.
3) Commit your changes and push them to your forked repository.
4) Navigate to the main `cache-manager` repository and select the *Pull Requests* tab.
5) Click the *New pull request* button, then select the option "Compare across forks"
6) Leave the base branch set to main. Set the compare branch to your forked branch, and open the pull request.
7) Once your pull request is created, ensure that all checks have passed and that your branch has no conflicts with the base branch. If there are any issues, resolve these changes in your local repository, and then commit and push them to git.
8) Similarly, respond to any reviewer comments or requests for changes by making edits to your local repository and pushing them to Git.
9) Once the pull request has been reviewed, those with write access to the branch will be able to merge your changes into the `cache-manager` repository.

If you need more information on the steps to create a pull request, you can find a detailed walkthrough in the [Github documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)

## Post an Issue

To post an issue, navigate to the "Issues" tab in the main repository, and then select "New Issue." Enter a clear title describing the issue, as well as a description containing additional relevant information. Also select the label that best describes your issue type. For a bug report, for example, create an issue with the label "bug." In the description field, Be sure to include replication steps, as well as any relevant error messages.

If you're reporting a security violation, be sure to check out the project's [security policy](SECURITY.md).

Please also refer to our [Code of Conduct](CODE_OF_CONDUCT.md) for more information on how to report issues.

## Ask a Question

To ask a question, create an issue with the label "question." In the issue description, include the related code and any context that can help us answer your question.

## License
MIT [LISCENCE](LICENSE)
