# ember
Volatility-aware trading system. UHI3 Hookathon.

A user will pay higher or lower swap fees based on current volatility.

A user wishes to trade.
They go to the UI, and simulate their transaction without diversion.
They notice whether their trade will increase volatility or decrease volatility.
If they are high volatility, they can choose to pay the dynamic fee.
If they are low volatility, they can choose to get a small refund.

## Description

There are 4 components to the system:
1. Uniswap hook in Solidity
2. Arbitrum Stylus smart contract that computes volatility per trade

## Testing

```
npx ts-node src/test/integration_with_pools.test.ts -vvvvvv
```