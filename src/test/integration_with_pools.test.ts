import { BaseContract, ethers, MaxUint256, Log } from "ethers"
import * as integrationTest from "./integration.test"
import IPoolManager from "../../../ember-hook/out/IPoolManager.sol/IPoolManager.json"
import PoolManager from "../../../ember-hook/out/PoolManager.sol/PoolManager.json"
import PoolSwapTest from "../../../ember-hook/out/PoolSwapTest.sol/PoolSwapTest.json"
import PoolModifyLiquidityTest from "../../../ember-hook/out/PoolModifyLiquidityTest.sol/PoolModifyLiquidityTest.json"
import EmberERC20 from "../../../ember-hook/out/EmberERC20.sol/EmberERC20.json"
import Quoter from "../../../ember-hook/out/Quoter.sol/Quoter.json"
import Create2Deployer from "../../../ember-hook/out/Create2Deployer.sol/Create2Deployer.json"
import HM from "../../../ember-hook/out/HM.sol/HM.json"
import VolatilityFeesHook from "../../../ember-hook/out/VolatilityFeesHook.sol/VolatilityFeesHook.json"
import Currency from "../../../ember-hook/out/Currency.sol/CurrencyLibrary.json"
import EmberPoolManager from "../../../ember-hook/out/EmberPoolManager.sol/EmberPoolManager.json"
import LiquidityAmounts from "../../../ember-hook/out/LiquidityAmounts.sol/LiquidityAmounts.json"

const chainOwnerPrivateKey = integrationTest.PRIVATE_KEY
const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const volatilityCalculatorAddress = integrationTest.stylusAddress

const BEFORE_SWAP_FLAG = BigInt(1) << BigInt(7)
const AFTER_SWAP_FLAG = BigInt(1) << BigInt(6)
const AFTER_SWAP_RETURNS_DELTA_FLAG = BigInt(1) << BigInt(2)

const MIN_PRICE_LIMIT = BigInt("4295128740") + BigInt(1)
const MAX_PRICE_LIMIT = BigInt("1461446703485210103287273052203988822378723970342") - BigInt(1)

const ZERO_BYTES = new Uint8Array(0)

const arbitrum_one_chainid = 412346
const options: ethers.JsonRpcApiProviderOptions = {
    polling: true,
    staticNetwork: true,
    batchStallTime: 1,
    batchMaxSize: 1,
    batchMaxCount: 1,
    cacheTimeout: 1,
    pollingInterval: 1,
}

const provider = new ethers.JsonRpcProvider('http://localhost:8547', arbitrum_one_chainid, options)
// provider.on("debug", console.log)
// provider.on("error", console.error)
// provider.on("network", console.log)

const wallet = new ethers.Wallet(privateKey, provider)
const account0 = wallet

export function sortContractsByAddress(token0: BaseContract, token1: BaseContract): [BaseContract, BaseContract] {
    let ret: [BaseContract, BaseContract]
    if (token0.target < token1.target) {
        ret = [token0, token1]
    } else {
        ret = [token1, token0]
    }
    return ret
}

export async function deployFull() {
    const quotes: any[] = []

    // send some eth from ownerWallet to wallet
    const tx = await integrationTest.ownerWallet.sendTransaction({
        to: account0.address,
        value: ethers.parseEther("1.0")
    })

    const poolManagerF = new ethers.ContractFactory(PoolManager.abi, PoolManager.bytecode.object, account0)
    const poolManagerD = await poolManagerF.deploy(account0.address)
    await poolManagerD.waitForDeployment()
    const poolManager = new ethers.Contract(poolManagerD.target, PoolManager.abi, account0)
    console.log("PoolManager deployed at: ", poolManager.target)

    // poolManager.on("*", (eventName, ...args) => {
    //     console.log("PoolManager event: ", eventName, args)
    // })

    const swapRouterF = new ethers.ContractFactory(PoolSwapTest.abi, PoolSwapTest.bytecode.object, account0)
    const swapRouterD = await swapRouterF.deploy(poolManager.target)
    await swapRouterD.waitForDeployment()
    const swapRouter = new ethers.Contract(swapRouterD.target, PoolSwapTest.abi, account0)
    console.log("SwapRouter deployed at: ", swapRouter.target)

    const tokenF = new ethers.ContractFactory(EmberERC20.abi, EmberERC20.bytecode, account0)
    const token0D = await tokenF.deploy("Token0", "TK0", 18)
    await token0D.waitForDeployment()
    console.log("Token0 deployed")

    const token1D = await tokenF.deploy("Token1", "TK0", 18)
    await token1D.waitForDeployment()
    console.log("Token1 deployed")

    const token0 = new ethers.Contract(token0D.target, EmberERC20.abi, account0)
    const token1 = new ethers.Contract(token1D.target, EmberERC20.abi, account0)

    const mintAmount = ethers.parseEther(BigInt(10000).toString())

    await token0.mint(account0.address, mintAmount).then((tx) => tx.wait())
    console.log("Token0 minted")

    await token1.mint(account0.address, mintAmount).then((tx) => tx.wait())
    console.log("Token1 minted")

    const [currency0, currency1] = sortContractsByAddress(token0, token1)
    console.log("Sorted tokens")

    const create2DeployerF = new ethers.ContractFactory(Create2Deployer.abi, Create2Deployer.bytecode.object, account0)
    const create2DeployerD = await create2DeployerF.deploy().then(tx => tx.waitForDeployment())
    await create2DeployerD.waitForDeployment().then()
    console.log("Create2Deployer deployed at: ", create2DeployerD.target)

    const create2Deployer = new ethers.Contract(create2DeployerD.target, Create2Deployer.abi, account0)

    const HookMinerF = new ethers.ContractFactory(HM.abi, HM.bytecode.object, account0)
    const hookMinerD = await HookMinerF.deploy().then(tx => tx.waitForDeployment())
    await hookMinerD.waitForDeployment().then()
    console.log("HookMiner Library deployed at: ", hookMinerD.target)

    const quoterF = new ethers.ContractFactory(Quoter.abi, Quoter.bytecode.object, account0)
    const quoterD = await quoterF.deploy(poolManager.target).then(tx => tx.waitForDeployment())
    await quoterD.waitForDeployment().then(tx => tx)
    const quoter = new ethers.Contract(quoterD.target, Quoter.abi, account0)
    console.log("Quoter deployed at: ", quoter.target)

    const hookMiner = new ethers.Contract(hookMinerD.target, HM.abi, account0)
    let hookAddress: any
    let salt: any

    while (true) {
        try {
            [hookAddress, salt] = await hookMiner.find(
                create2Deployer.target,
                AFTER_SWAP_FLAG | AFTER_SWAP_RETURNS_DELTA_FLAG,
                ethers.solidityPacked(["bytes"], [VolatilityFeesHook.bytecode.object]),
                ethers.AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolManager.target, volatilityCalculatorAddress]
                ),
                { gas: 10000000 }
            )
            console.log("Hook address: ", hookAddress)
            console.log("Salt: ", salt)
            break
        } catch (error) {
            console.error("Couldn't finding hook address. Trying again.")
            continue
        }
    }

    const codeHashWithConstructorArgs = ethers.solidityPacked(
        ["bytes", "bytes"],
        [VolatilityFeesHook.bytecode.object, ethers.AbiCoder.defaultAbiCoder().encode(["address", "address"], [poolManager.target, volatilityCalculatorAddress])]
    )

    await create2Deployer.deploy(0, salt, codeHashWithConstructorArgs).then(tx => tx.wait())
    console.log("Deployed hook to address: ", hookAddress)

    integrationTest.getVolatility().then(console.log)
    const hookContract = new ethers.Contract(hookAddress, VolatilityFeesHook.abi, account0)
    hookContract.on("*", (id: any, ...args) => {
        console.log(`Mark: `, id, args)
        integrationTest.getVolatility().then(console.log)
        console.log()
    })

    const sqrtPriceX96 = BigInt("79228162514264337593543950336")
    const fee = 500
    const tickSpacing = fee % 100 === 0 ? 60 : (fee / 100) * 2
    const currency0C = new ethers.Contract(currency0, Currency.abi, account0)
    const currency1C = new ethers.Contract(currency1, Currency.abi, account0)
    const poolKey = {
        currency0: currency0C.target,
        currency1: currency1C.target,
        fee: fee,
        tickSpacing: tickSpacing,
        hooks: hookAddress
    }

    await poolManager.initialize(poolKey, sqrtPriceX96).then(tx => tx.wait())
    console.log("Pool initialized")

    const modifyLiquidityRouterF = new ethers.ContractFactory(PoolModifyLiquidityTest.abi, PoolModifyLiquidityTest.bytecode.object, account0)
    const modifyLiquidityRouterD = await modifyLiquidityRouterF.deploy(poolManager.target).then(tx => tx.waitForDeployment())
    await modifyLiquidityRouterD.waitForDeployment()
    const modifyLiquidityRouter = new ethers.Contract(modifyLiquidityRouterD.target, PoolModifyLiquidityTest.abi, account0)

    await token0.approve(modifyLiquidityRouter.target, mintAmount)
    await token1.approve(modifyLiquidityRouter.target, mintAmount)
    await token0.approve(swapRouter.target, mintAmount)
    await token1.approve(swapRouter.target, mintAmount)
    await token0.approve(quoter.target, mintAmount)
    await token1.approve(quoter.target, mintAmount)

    console.log("Approved tokens")

    async function seedMoreLiquidity(poolKey: any, amount0: bigint, amount1: bigint) {
        const LIQUIDITY_PARAMS = {
            tickLower: -120,
            tickUpper: 120
        }

        // deploy an EmpberPoolManager for public access to slot0
        const emberPoolManagerF = new ethers.ContractFactory(EmberPoolManager.abi, EmberPoolManager.bytecode, account0)
        const emberPoolManagerD = await emberPoolManagerF.deploy().then(tx => tx.waitForDeployment())
        await emberPoolManagerD.waitForDeployment()
        const emberPoolManager = new ethers.Contract(emberPoolManagerD.target, EmberPoolManager.abi, account0)

        // example call to getSlot0()
        // const { sqrtPriceX96, tick, protocolFee, lpFee } = await emberPoolManager.getSlot0(poolManager.target, poolKey)

        const liquidityDelta_value = await emberPoolManager.getLiquidityForAmounts(poolManager.target, poolKey, amount0, amount1)

        const params = {
            tickLower: LIQUIDITY_PARAMS.tickLower,
            tickUpper: LIQUIDITY_PARAMS.tickUpper,
            liquidityDelta: liquidityDelta_value + "",
            salt: ethers.ZeroHash
        }

        await modifyLiquidityRouter.modifyLiquidity(poolKey, params, ZERO_BYTES, { gas: 4000000 }).then(tx => tx.wait())
        console.log("Liquidity seeded")
    }

    const liquidity_amt = ethers.parseEther("1.0")
    await seedMoreLiquidity(poolKey, liquidity_amt, liquidity_amt).then(tx => tx)

    console.log("Currency0: ", currency0.target)
    console.log("Currency1: ", currency1.target)
    console.log("PoolManager deployed at: ", poolManager.target)
    console.log("Quoter deployed at: ", quoter.target)
    console.log("Volatility Calculator at: ", volatilityCalculatorAddress)
    console.log("VolatilityFeesHook deployed at: ", hookAddress)
    console.log("Pool initialized")

    const zeroForOne = true
    const quoteParams = {
        poolKey: poolKey,
        zeroForOne: zeroForOne,
        recipient: account0.address,
        exactAmount: ethers.parseUnits("1", 18),
        sqrtPriceLimitX96: MIN_PRICE_LIMIT,
        hookData: ZERO_BYTES
    }

    await token0.balanceOf(account0.address).then(console.log)
    await token1.balanceOf(account0.address).then(console.log)

    await token0.allowance(account0.address, quoter.target).then(console.log)
    await token1.allowance(account0.address, quoter.target).then(console.log)

    await new Promise<void>((resolve) => {
        quoter.once("QuoteEvent", (deltaAmounts, sqrtPriceX96After, initalizedTicksLoaded, ...args) => {
            quotes.push([deltaAmounts, sqrtPriceX96After, initalizedTicksLoaded])
            resolve()
        })

        quoter.quoteExactInputSingle(quoteParams).then(tx => tx.wait())
    })

    console.log("Last quote: ", quotes[quotes.length - 1])

    const swapParams = {
        zeroForOne: zeroForOne,
        amountSpecified: 10,
        sqrtPriceLimitX96: zeroForOne ? MIN_PRICE_LIMIT : MAX_PRICE_LIMIT,
    }

    const testSettings = {
        takeClaims: false,
        settleUsingBurn: false
    }

    try {
        for (let i = 0; i < 10; i++) {
            console.log("Swap iteration: ", i)

            console.log("Before swap")
            console.log("Account:")
            await token0.balanceOf(account0.address).then(console.log)
            await token1.balanceOf(account0.address).then(console.log)
            console.log("PoolManager:")
            await token0.balanceOf(poolManager.target).then(console.log)
            await token1.balanceOf(poolManager.target).then(console.log)
            console.log("VolatilityContract:")
            await integrationTest.getVolatility()

            await swapRouter.swap(poolKey,
                swapParams,
                testSettings,
                ZERO_BYTES,
            ).then(tx => tx.wait())

            console.log("After swap")
            console.log("Account:")
            await token0.balanceOf(account0.address).then(console.log)
            await token1.balanceOf(account0.address).then(console.log)
            console.log("PoolManager:")
            await token0.balanceOf(poolManager.target).then(console.log)
            await token1.balanceOf(poolManager.target).then(console.log)
            console.log("VolatilityContract:")
            await integrationTest.getVolatility()
        }

    } catch (e) {
        console.error("Error: ", e)
    }

    console.log("end of deployFull")

}

export async function doStylusSwap() {
    await integrationTest.addSwap(1)
    const idx = await integrationTest.getIndex()
    console.log(`Index: `, idx.toString())
}

(async () => {
    deployFull()
})()