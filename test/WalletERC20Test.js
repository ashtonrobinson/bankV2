const { inputToConfig } = require('@ethereum-waffle/compiler');
const { expect, assert } = require('chai');
const hre = require('hardhat');
const ethers = hre.ethers;

//testing suite for walletERC-20
describe('Testing Suite for WalletERC20', function () {
    let provider;
    let signers;
    let owner;
    // list of 3 signer objects that are the approvers of the wallet
    let approvers;
    let extraSigners;
    //both of the contracts are tied to the owner
    let walletContract;
    let tokenContract;

    // an instance of the wallet tied to approvers[0]
    let approverConnection;

    // create ERC-20 tokens with Test token 
    before(async function () {
        provider = ethers.provider;
        [owner, ...signers] = await ethers.getSigners();

        //create and deploy erc 20 test token
        approvers = new Array();
        extraSigners = signers.filter(sign => !approvers.includes(sign))

        hre.filterAddresses(signers, approvers);

        let WalletFactory = await ethers.getContractFactory('WalletERC20');
        walletContract = await WalletFactory.deploy(hre.getAddresses(approvers));

        let TokenFactory = await ethers.getContractFactory('TestToken');
        tokenContract = await TokenFactory.deploy(1000000000);

        //send wallet tokens from creator
        tokenContract.transfer(walletContract.address, 100);
    });

    describe("Initialization", async function () {
        
        //test 1, not initialized
        it('not initialized', async function (){
            approverConnection = walletContract.connect(approvers[0]);

            await expect(walletContract.getTokenAddress()).to.be.revertedWith("no erc contract set");
            await expect(approverConnection.createERC20Transfer(extraSigners[0].address,10)).to.be.revertedWith("no erc contract set");
        });

        // correct initialization 
        it('initialized', async function (){
            // correctly initialize
            await approverConnection.setToken(tokenContract.address);

            expect(await approverConnection.getTokenAddress()).to.equal(tokenContract.address);
        });
    });

    describe("Transaction creation for sending ERC20", async function (){
        //test one, not enough funds
        it('not enough funds', async function () {
            await expect(approverConnection.createERC20Transfer(extraSigners[0].address, 1000)).to.be.revertedWith("not enough funds");
        });

        //test two, correct creation and approval
        it('correct creation and approval', async function (){
            let toAddr = extraSigners[0].address;
            await expect(approverConnection.createERC20Transfer(toAddr, 1)).to.emit(walletContract, "SubmitTransaction")
                .withArgs(approvers[0].address);

            let approverConnectionTwo = approverConnection.connect(approvers[1]);

            await expect(approverConnectionTwo.confirmAndExecuteTransaction()).to.emit(walletContract, 'TransactionExecuted')
                .withArgs(approvers[1].address);

            expect(await tokenContract.balanceOf(toAddr)).to.equal(1);
        }); 
    });
});