# ember
Uniswap V4 volatility-based dynamic fees. UHI3 Hookathon.

A user will pay higher swap fees if they increase volatility, or lower swap fees if they decrease volatility.

They Uniswap V4 hook is backed by a smart contract that can calculate volatility, which is written in Arbitrum Stylus.

## Architecture

There are 4 components to the system:
1. Arbitrum Nitro [devnode](https://github.com/OffchainLabs/nitro-devnode)
2. [enber-stylus](https://github.com/shahankhatch/ember-stylus): Arbitrum Stylus smart contract that computes volatility
3. [ember-hook](https://github.com/shahankhatch/ember-hook): Uniswap v4 hook in Solidity
4. [ember](#): Integration app in typescript. This repo.

They should all be cloned into the same directory as there are some relative path dependencies between the repos:
- ember-hook depends ember-stylus for Solidity interface and JSON ABI
- ember depends on ember-hook

## Deployment process

1. nitro-devnode: `run-dev-node.sh`
2. ember-stylus: `cargo stylus check` and `cargo stylus deploy` ember-stylus (see ember-stylus readme)
3. ember-hook: `build.sh`
4. ember: `npx ts-node src/test/integration_with_pools.test.ts`
