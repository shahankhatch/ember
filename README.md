# ember
Volatility-aware trading system. UHI3 Hookathon.

A user will pay higher or lower swap fees based on current volatility.

A user wishes to trade.
They go to the UI, and simulate their transaction without diversion.
They notice whether their trade will increase volatility or decrease volatility.
If they are high volatility, they can choose to pay the dynamic fee.
If they are high volatility, they can also choose to diver to the EL AVS.
If they are low volatility, they can choose to get a small refund.
If they are low volatility, they can choose to postpone the refund and to get a bigger refund through brevis.

## Description

There are 4 components to the system:
1. Uniswap hook in Solidity
2. Arbitrum Stylus smart contract that computes volatility per trade
3. EigenLayer AVS to order match volatile orders
4. Brevis proving system to refund non-volatile orders

## Uniswap hook in Solidity to set dynamic fees

- track 100 swaps
- until we have 100 swaps, volatility is fixed at 100%
- in beforeSwap, measure volatility before the swap, measure volatility after simulating the swap
- user provides two hook-specific params: (bool highVolatilityImmediate, bool lowVolatilityImmediate)
- if highVolatilityImmediate is True, execute the swap on the dex, charging higher swap fees
- if highVolatilityImmediate is False, nop, collect funds and divert swap to order book on EigenLayer
- if lowVolatilityImmediate is True, execute swap on the dex, charging a lower swap fee
- if lowVolatilityImmediate is False, nop, collect low volatility trade for larger refund eligibility to be proven via Brevis

The hook calls out to a smart contract written in Stylus to compute the volatility; the current implementation of volatility is in Solidity.



## Pending Tasks

- Dockerize ember-stylus for compilation and deployment
