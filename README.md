# README

The purpose of this repository is to share an example of using shipit with TypeScript as I couldn't find any.

I simply compile the TypeScript to JavaScript so that it can be used without ts-node.

I write my deployment code in `src/shipitfile.ts`

I used to use Capistrano, but I wanted everything inside JavaScript/TypeScript so that I only needed to know one language.

Warning: This may be an outdated example, so I'll try to update it as I can.

Please leave any comments or feedback in this GitHub issue:

https://github.com/aizatto/shipit-deploy-example/issues/1

I generally put a directory similar to this in my [Lerna](https://github.com/lerna/lerna) managed monorepo. For example it may live in:

```sh
packages/deploy
```

Then whenever I need to deploy, I go into that folder and run:

```sh
yarn deploy
```

# Usage

Remember to compile TypeScript before deploying.

```sh
yarn build
```

```sh
yarn deploy
```

Or all in one go:

```sh
yarn build && cat build/shipitfile.js && yarn deploy
```

# Design Decisions

1. This is all in its own repository to isolate deployment work
2. TypeScript: I wanted TypeScript

If I want to change the `tsconfig.json` `target`, looks like I need to install some babel-types

# Links

- https://github.com/shipitjs/shipit
- https://github.com/shipitjs/shipit/tree/master/packages/shipit-deploy
- https://nodejs.org/api/child_process.html

# Deployment may fail midway if your firewall prevents it

Your firewall may limit number of ssh connections in a time window

This is not secure, but a good way to work around. On your server (if using `ufw`):

```sh
ufw allow 22
```
