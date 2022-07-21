const hre = require('hardhat');
const ethers = hre.ethers;

// the abi for pools in v3
const { abi } = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json');
const IUniswapV3PoolABI = abi;

//simple script to interact with the uniswap sdk on mainnet
const provider = ethers.provider;

// this needs to be dynamic
const poolAddress = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';


const poolContract = new ethers.Contract(poolAddress, IUniswapV3PoolABI, provider);

// the immutable pool data for each pool
async function getPoolImmutables() {
    const values = await Promise.all([
        poolContract.factory(),
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.maxLiquidityPerTick(),
    ]);

    return {
        factory: values[0], 
        token0: values[1], 
        token1: values[2], 
        fee: values[3], 
        tickSpacing: values[4], 
        maxLiquidityPerTick: values[5]
    }
}


async function getPoolState(){
    const [liquidity, slot] = await Promise.all([poolContract.liquidity(), poolContract.slot0()])

    return {
        liquidity: liquidity, 
        sqrtPriceX96: slot[0],
        tick: slot[1],
        observationIndex: slot[2],
        observationCardinality: slot[3],
        observationCardinalityNext: slot[4],
        feeProtocol: slot[5],
        unlocked: slot[6]
    }
}
  
getPoolImmutables().then((result) => {
    console.log(result);
});

getPoolState().then((result) => {
    console.log(result);
});





