import { ethers } from "ethers"
import stylusAbi from "../../../ember-stylus/target/ember-stylus.json"
import assert from "assert"

const ARBITRUM_RPC_URL = "http://localhost:8547"
export const PRIVATE_KEY = "0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"

export const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL)
export const ownerWallet = new ethers.Wallet(PRIVATE_KEY, provider)

// Address of your deployed Stylus contract
export const stylusAddress = "0xA6E41fFD769491a42A6e5Ce453259b93983a22EF"

// Initialize the contract
export const stylusContract = new ethers.Contract(stylusAddress, stylusAbi, ownerWallet)

// Example function calls
async function simulateSwap(swapValue: number) {
    const tx = await stylusContract.simulateSwap(swapValue)
    console.log(`Transaction Hash:`, tx.hash)
    const receipt = await tx.wait()
    console.log(`Simulated Swap Receipt:`, receipt)
}

export async function getIndex() {
    const result = await stylusContract.index()
    console.log(`Index:`, result.toString())
    return result
}

export async function getVolatility() {
    const result = await stylusContract.getVolatility()
    console.log(`Volatility:`, result.toString())
    return result
}

export async function addSwap(swapValue: number) {
    const tx = await stylusContract.addSwap(swapValue)
    console.log(`Transaction Hash:`, tx.hash)
    const receipt = await tx.wait()
    console.log(`Add Swap Receipt:`, receipt)
}

async function runTestSequence() {
    const i1 = await getIndex()
    await simulateSwap(1000)
    const i2 = await getIndex()
    await addSwap(1000)
    const i3 = await getIndex()
    assert(i1 == i2 && i2 < i3)
}


// (async () => {
//     runTestSequence().catch((error) => console.error(`Error during test sequence:`, error))
// })()