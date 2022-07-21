require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");

require('dotenv').config();

//create a task that can deploy to testnet and save the metadata associated with the deployment

extendEnvironment((hre) => {
  // choose three random addresses to create the wallet with
  function choose(upperBound, num) {
    chosen = new Set();
    for (let i = 0; i < num; i++) {
        let value = Math.floor(Math.random() * upperBound);
        if (!chosen.has(value)){
            chosen.add(value);
        } else {
            i--;
        }
    }
    return Array.from(chosen);
  } 
  hre.choose = choose;
  hre.chooseThree = (upper) => choose(upper, 3);
});

const alchemyKey = process.env.ALCHEMY;
const devKey = `0x`+ process.env.DEPLOYER;

const appKeyOne = `0x`+ process.env.APPROVER_ONE;
const appKeyTwo = `0x`+ process.env.APPROVER_TWO;
const appKeyThree = `0x`+ process.env.APPROVER_THREE;

const bankAppKeyOne = `0x` + process.env.BANK_APPROVER_ONE;
const bankAppKeyTwo = `0x` + process.env.BANK_APPROVER_TWO;

const extraKeyOne = `0x` + process.env.EXTRA_KEY_ONE;
const extraKeyTwo = `0x` + process.env.EXTRA_KEY_TWO;
const extraKeyThree = `0x` + process.env.EXTRA_KEY_THREE;
const extraKeyFour = `0x` + process.env.EXTRA_KEY_FOUR;
const extraKeyFive = `0x` + process.env.EXTRA_KEY_FIVE;


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: [
        {privateKey: devKey, balance: '100000000000000000000'}, 
        {privateKey: appKeyOne, balance: '100000000000000000000'}, 
        {privateKey: appKeyTwo, balance: '100000000000000000000'}, 
        {privateKey: appKeyThree, balance: '100000000000000000000'}, 
        {privateKey: bankAppKeyOne, balance: '100000000000000000000'}, 
        {privateKey: bankAppKeyTwo, balance: '100000000000000000000'},
        {privateKey: extraKeyOne, balance: '100000000000000000000'},
        {privateKey: extraKeyTwo, balance: '100000000000000000000'},
        {privateKey: extraKeyThree, balance: '100000000000000000000'},
        {privateKey: extraKeyFour, balance: '100000000000000000000'},
        {privateKey: extraKeyFive, balance: '100000000000000000000'},
      ],
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${alchemyKey}`,
      chainId: 5,
      accounts: [devKey, appKeyOne, appKeyTwo, appKeyThree, bankAppKeyOne, bankAppKeyTwo],
    }
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
};
