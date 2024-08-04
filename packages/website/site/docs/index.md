---
title: 'Getting Started Guide'
order: 1
---

# How to Use the Cacheable Mono Repo

Cacheable has the main package `cacheable-request` under `/packages/request` and its website. In addtion we have a couple of other documents for review:

* [CODE_OF_CONDUCT.md](https://github.com/jaredwray/cacheable/blob/main/CODE_OF_CONDUCT.md) - Our code of conduct
* [CONTRIBUTING.md](https://github.com/jaredwray/cacheable/blob/main/CONTRIBUTING.md) - How to contribute to this project
* [SECURITY.md](https://github.com/jaredwray/cacheable/blob/main/SECURITY.md) - Security guidelines and supported versions

## Open a Pull Request

You can contribute changes to this repo by opening a pull request:

1) After forking this repository to your Git account, make the proposed changes on your forked branch.
2) Run tests and linting locally.
	- Run `yarn && yarn test`.
3) Commit your changes and push them to your forked repository.
4) Navigate to the main `cacheable` repository and select the *Pull Requests* tab.
5) Click the *New pull request* button, then select the option "Compare across forks"
6) Leave the base branch set to main. Set the compare branch to your forked branch, and open the pull request.
7) Once your pull request is created, ensure that all checks have passed and that your branch has no conflicts with the base branch. If there are any issues, resolve these changes in your local repository, and then commit and push them to git.
8) Similarly, respond to any reviewer comments or requests for changes by making edits to your local repository and pushing them to Git.
9) Once the pull request has been reviewed, those with write access to the branch will be able to merge your changes into the `cacheable` repository.

If you need more information on the steps to create a pull request, you can find a detailed walkthrough in the [Github documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork)

## Post an Issue

To post an issue, navigate to the "Issues" tab in the main repository, and then select "New Issue." Enter a clear title describing the issue, as well as a description containing additional relevant information. Also select the label that best describes your issue type. For a bug report, for example, create an issue with the label "bug." In the description field, Be sure to include replication steps, as well as any relevant error messages.

If you're reporting a security violation, be sure to check out the project's [security policy](https://github.com/jaredwray/cacheable/blob/main/SECURITY.md).

Please also refer to our [Code of Conduct](https://github.com/jaredwray/cacheable/blob/main/CODE_OF_CONDUCT.md) for more information on how to report issues.

## Ask a Question

To ask a question, create an issue with the label "question." In the issue description, include the related code and any context that can help us answer your question.

## Packages in this Repository

* [cacheable-request](/docs/request): Simple key-value storage with support for multiple backends
* [website](https://github.com/jaredwray/cacheable/tree/main/packages/website): Website for cacheable.org site and documentation

There are currently plans for muyltiple other packages to be added to this repository. If you have any ideas for packages that you would like to see added, please open an issue in the main repository.
