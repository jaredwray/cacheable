# Cache Manager

This is the cache manager mono repo that has the following packages:
* `cache-manager` - The core package that provides the cache manager library.
* `cache-manager-redis-yet` - The redis store for cache manager.
* `cache-manager-ioredis-yet` - The ioredis store for cache manager.

## Getting Started

To get started you can visit the [cache-manager](/packages/cache-manager/README.md) package and learn how to use it. In addition here are some other documents:

* [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Our code of conduct
* [CONTRIBUTING.md](CONTRIBUTING.md) - How to contribute to this project
* [SECURITY.md](SECURITY.md) - Security guidelines and supported versions

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

## Request the Addition of a Storage Adapter

To request a new storage adapter, create an issue with the label "storage adapter." In the issue description, include any relevant information about the storage adapter that you would like to be added. 

Once this request has been submitted in "issues" we will give it 30-60 days for any upvotes to take place. If there is little interest in the request, it will be closed.

If there is already an adapter that you would like to add, please post an issue with the label "storage adapter" and include the name of the adapter you would like to add with the description and any relevant information. 

## License
MIT [LISCENCE](LICENSE)
