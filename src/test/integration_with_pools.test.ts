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
// import Hooks from "../../../ember-hook/out/Hooks.sol/Hooks.json"
import VolatilityFeesHook from "../../../ember-hook/out/VolatilityFeesHook.sol/VolatilityFeesHook.json"
import Currency from "../../../ember-hook/out/Currency.sol/CurrencyLibrary.json"
import EmberPoolManager from "../../../ember-hook/out/EmberPoolManager.sol/EmberPoolManager.json"
import LiquidityAmounts from "../../../ember-hook/out/LiquidityAmounts.sol/LiquidityAmounts.json"

const chainOwnerPrivateKey = '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659'
const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const volatilityCalculatorAddress = "0xA6E41fFD769491a42A6e5Ce453259b93983a22EF"

const BEFORE_SWAP_FLAG = BigInt(1) << BigInt(7)
const AFTER_SWAP_FLAG = BigInt(1) << BigInt(6)

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
const ownerWallet = new ethers.Wallet(chainOwnerPrivateKey, provider)
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
    // send some eth from ownerWallet to wallet
    const tx = await ownerWallet.sendTransaction({
        to: account0.address,
        value: ethers.parseEther("1.0")
    })

    const poolManagerF = new ethers.ContractFactory(PoolManager.abi, PoolManager.bytecode.object, account0)
    const poolManagerD = await poolManagerF.deploy(account0.address)
    await poolManagerD.waitForDeployment()
    const poolManager = new ethers.Contract(poolManagerD.target, PoolManager.abi, account0)
    console.log("PoolManager deployed at: ", poolManager.target)

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

    // token0.initialize.send().then((tx) => tx.wait())
    // console.log("Token0 initialized")
    // token1.initialize.send().then((tx) => tx.wait())
    // console.log("Token1 initialized")

    const mintAmount = ethers.parseEther(BigInt(10000).toString())

    await token0.mint(account0.address, mintAmount).then((tx) => tx.wait())
    console.log("Token0 minted")

    await token1.mint(account0.address, mintAmount).then((tx) => tx.wait())
    console.log("Token1 minted")

    const [currency0, currency1] = sortContractsByAddress(token0, token1)
    console.log("Sorted tokens")

    // await new Promise(async resolve => setTimeout(resolve, 4000))
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
                BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG,
                ethers.solidityPacked(["bytes"], [VolatilityFeesHook.bytecode.object]),
                ethers.AbiCoder.defaultAbiCoder().encode(["address", "address", "address"], [poolManager.target, volatilityCalculatorAddress, quoter.target]
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
        [VolatilityFeesHook.bytecode.object, ethers.AbiCoder.defaultAbiCoder().encode(["address", "address", "address"], [poolManager.target, volatilityCalculatorAddress, quoter.target])]
    )

    await create2Deployer.deploy(0, salt, codeHashWithConstructorArgs).then(tx => tx.wait())
    console.log("Deployed hook to address: ", hookAddress)
    // await hook_deployment.waitForDeployment().then()

    // const hook = new ethers.Contract(hookAddress, VolatilityFeesHook.abi, account0)

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

    // await seedMoreLiquidity(poolKey, ethers.parseEther("10"), ethers.utils.parseEther("10"))

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
        // await emberPoolManager.seedMoreLiquidity(poolManager.target, modifyLiquidityRouter.target, poolKey, amount0, amount1, { gas: 2000000 })
        console.log("Liquidity seeded")
        // return 1
    }

    poolManager.on("*", (eventName, ...args) => {
        console.log(`Event: ${eventName.eventName}: ${eventName.args}`)
        // console.log(eventName)
        // console.log(args.toString())
    })

    quoter.on("*", (eventName, ...args) => {
        console.log(`Event: ${eventName.eventName}: ${eventName.args}`)
    })

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



    console.log("trying...")

    try {
        await quoter.quoteExactInputSingle(quoteParams)
    } catch (error) {
        const e: any = error
        console.error("Error caught:", error)

        if (e.data) {
            // Decode revert data manually
            console.log("Raw revert data:", e.data)

            // Try decoding using the ABI
            try {
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                    ["int128[]", "uint160", "uint32"], // Expected revert data structure
                    "0x" + e.data.slice(10) // Skip selector if present
                )
                console.log("Decoded revert data:", decoded)
            } catch (decodeError) {
                console.error("Error decoding revert data:", decodeError)
            }
        } else {
            console.error("No revert data available")
        }
    }


    try {
        const response = await quoter.quoteExactInputSingle(quoteParams)
        console.log("quote response:", response)

        const receipt = await response.wait().then(tx)
        console.log("quote receipt:", receipt);

        // const txHash = receipt.hash

        (async function () {
            const txData = await provider.getTransaction(receipt.hash)

            if (txData == null) {
                throw new Error('Transaction not found')
            }
            let modifiedTxData = {
                ...txData
            }

            // IMPORTANT! Otherwise the mock call will fail because these fields cannot co-exist...
            if (txData.gasPrice) {
                modifiedTxData.maxFeePerGas = null
                modifiedTxData.maxPriorityFeePerGas = null
            }

            try {
                const res = await provider.call(modifiedTxData)

                console.log({ res })

                const errorReasonMessage = ethers.toUtf8String('0x' + res.substring(138)).replaceAll('\x00', '') // clear the empty bytes

                console.log({ errorReasonMessage })
            }
            catch (err) {
                console.log({ err })
            }
        })()

        const { deltaAmounts, sqrtPriceX96After, initializedTicksLoaded } = await quoter.quoteExactInputSingle(quoteParams).then(tx => tx.wait())
        console.log("quote Success")
        console.log(deltaAmounts[0].toString())
        console.log(deltaAmounts[1].toString())
        console.log(sqrtPriceX96After.toString())
        console.log(initializedTicksLoaded.toString())
    } catch (error) {
        console.log("quote Failed")
        console.log(error)
    }

}
// export async function loadDeploy() {
//     const privateKey = '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659'


//     const deployAddress = "0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519"
//     const provider = new ethers.JsonRpcProvider('http://localhost:8547')
//     const wallet = new ethers.Wallet(privateKey, provider)
//     const deployContract = new ethers.Contract(deployAddress, Deploy.abi, wallet)

//     await deployContract.run()
//     const slot0 = await deployContract.getSlot0()
//     const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0
//     console.log("sqrtPriceX96:", sqrtPriceX96.toString())
//     console.log("tick:", tick.toString())
//     console.log("protocolFee:", protocolFee.toString())
//     console.log("lpFee:", lpFee.toString())
//     console.log(`Index: `, deployContract.id)
//     // console.log(`Index: `, idx)
// }

// export async function deployDeploy() {
//     // Specify the private key
//     const privateKey = '0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659'

//     // Create a wallet instance
//     const provider = new ethers.JsonRpcProvider('http://localhost:8547')
//     const wallet = new ethers.Wallet(privateKey, provider)

//     // Deploy the Deploy contract. The bytecode for the contract is located at path ["bytecode"]["object"]
//     const deployContract = new ethers.ContractFactory(Deploy.abi, Deploy.bytecode.object, wallet)

//     // Optionally, you can deploy the contract
//     const contract = await deployContract.deploy()
//     console.log('Contract deployed:', contract)
// }

export async function loadPool() {
    await integrationTest.addSwap(1)
    const idx = await integrationTest.getIndex()
    console.log(`Index: `, idx.toString())
}

export async function loadPoolManager() {
    const poolManagerAddress = "0x9E545E3C0baAB3E08CdfD552C960A1050f373042"
    const poolManagerContract = new ethers.Contract(poolManagerAddress, IPoolManager.abi)
    await poolManagerContract.getSlot0(0x3c9a2ae2d128290e61753ce857c9e644472e4baf63a9f0789626ef9ad6f70a45)
    // const stateLibaryContract = new ethers.Contract()
    // await StateLibrary.getSlot0(poolManagerContract, 0xbe4e6818c12f488c0e23cd04702a315f4207b473cbb362cfc07b45b2a2ebf494)
}

(async () => {
    // await loadPool()
    // await loadPoolManager()
    // loadDeploy()
    // deployDeploy()
    deployFull()
})()