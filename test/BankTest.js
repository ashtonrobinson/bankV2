const { expect, assert } = require('chai');
const hre = require('hardhat');

// testing suite for Account.sol
describe("Bank Contract Testing Suite", function () {
    // variables used in testing suite created in before and beforeEach 
    let BankFactory;
    let Bank; 
    let bankConnTwo; // this is a connection to the contract from an approver

    let owner;
    let signers;
    //list of two signer objects that are the verified approvers of the bank
    let bankApprovers;
    //list of three signer objects whose addresses will be used to create the internal wallet
    let walletApprovers;
    let walletAddresses;
    //signers that are not bank nor wallet approvers
    let extraSigners;

    //zero address as a string
    let zeroAddr = "0x0000000000000000000000000000000000000000";

    //redeploy the contract before each test
    before(async function () {
        BankFactory = await ethers.getContractFactory('Bank');
        [owner, ...signers] = await ethers.getSigners();

        walletApprovers = new Array();
        bankApprovers = new Array();
        extraSigners = new Array();

        // generate random signers for the wallet instance to be created
        let indicies = hre.chooseThree(signers.length);
        for (index of indicies) {
            walletApprovers.push(signers[index]);
        }

        nonWalletApprovers = signers.filter(sign => !walletApprovers.includes(sign) && sign != owner);
        indicies = hre.choose(nonWalletApprovers.length, 2);

        for (i = 0; i < nonWalletApprovers.length; i++){
            if (indicies.includes(i)){
                bankApprovers.push(nonWalletApprovers[i]);
            } else {
                extraSigners.push(nonWalletApprovers[i])
            }
        }

        
        Bank = await BankFactory.deploy();
        await Bank.deployed();

        bankConnTwo = await Bank.connect(bankApprovers[0]);

        walletAddresses = walletApprovers.map(appr => appr.address);
    });

    describe("Deployment", function () {
        //test 1, correct owners
        it('correct owner', async function () {
            // only three owners allowed
            expect(await Bank.owner()).to.equal(owner.address);
        });

        //test 2, not iniated
        it('not initiated', async function () {
            // initiated should be set to false
            expect(await Bank.initiated()).to.equal(false);

            //all functions should revert
            await expect(Bank.createAccount('Ash', 'Rob')).to.be.revertedWith("contract has not been initiated yet");
            await expect(Bank.revokePendingAccount()).to.be.revertedWith("contract has not been initiated yet");
            await expect(bankConnTwo.deployAccount(walletAddresses)).to.be.revertedWith("contract has not been initiated yet")
        });
    });

    //assert that the signers are added correctly
    describe("Add Signers", function () {
        //test 1, invalid addresses for signers
        it('incorrect addresses, non owner', async function() {
            await expect(Bank.addSigners(Bank.address, bankApprovers[0].address)).to.be.revertedWith("approver cant be contract address");
            await expect(Bank.addSigners(bankApprovers[1].address, owner.address)).to.be.revertedWith("deployer cannot be an approver");
            await expect(Bank.addSigners(zeroAddr, bankApprovers[0].address)).to.be.revertedWith("cannot use zero address");

            bankConnTwo = await Bank.connect(bankApprovers[0]);
            await expect(bankConnTwo.addSigners(owner.address, bankApprovers[1].address)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });  

    // correct addition of signers followed by account creation
    describe("Approvers Added, Account Creation tests", function () {
        //variable to store the newly created account address
        let acctCreatedAddr;

        //add the correct approvers
        before(async function () {
            await Bank.addSigners(bankApprovers[0].address, bankApprovers[1].address);
            assert(await Bank.initiated());

            let apprs = await Bank.getApprovers(); 
            expect(apprs).to.have.members([bankApprovers[1].address, bankApprovers[0].address]);
        });

        // revoke the pending account if it exists
        afterEach(async function () {
            if (await Bank.hasPendingAccount()){
                await Bank.revokePendingAccount();
                assert(!(await Bank.hasPendingAccount()));
            }
        });

        //test 1, incorrect account creation, no current accounts
        it('Incorrect Account creation, no current accounts', async function () {
            //account creation from someone other than an owner
            await expect(bankConnTwo.createAccount('Ash', 'Rob')).to.be.revertedWith("Ownable: caller is not the owner");
            
            //attempt to revoke the pending account when there is no pending account
            await expect(Bank.revokePendingAccount()).to.be.revertedWith("no pending account");

            // correctly create an account and then attempt to create another 
            await expect(Bank.createAccount('Ash', 'Rob')).to.emit(Bank, 'AccountCreated');
            await expect(Bank.createAccount('Other', 'Person')).to.be.revertedWith( "pending account exists");
        });


        //test 2, correct creation and confirmation from approver
        it('correct creation, approval tests', async function () {
            first = 'Ash';
            last = 'Rob';
            await Bank.createAccount(first, last);

            // use a non approver address to deploy(in this case the owner of the Bank)
            await expect(Bank.deployAccount(walletAddresses)).to.be.revertedWith( "only approvers");

            // use an approver, but with an address that is invalid for the wallet to be created
            await expect(bankConnTwo.deployAccount([walletAddresses[0], walletAddresses[1], Bank.address]))
                .to.be.revertedWith("cannot be this address");
            await expect(bankConnTwo.deployAccount([walletAddresses[0], walletAddresses[1], zeroAddr]))
                .to.be.revertedWith("cannot be zero address");

            //correctly deploy the account
            expect(await bankConnTwo.deployAccount(walletAddresses)).to.emit(Bank, 'AccountDeployed');
            acctCreatedAddr = (await Bank.getAccountAddresses())[0];

            // assert that the account is of length one
            assert(await Bank.isAccount(acctCreatedAddr));

            // assert that we cannot double deploy
            await expect(bankConnTwo.deployAccount(walletAddresses)).to.be.revertedWith("no pending account");
        });

        //test 3, attempt to create a account with invalid wallet addresses
        it('correct creation, invalid wallet addresses', async function () {
            first = 'Rob';
            last = 'Tom';
            await Bank.createAccount(first, last);

            //use extra signers addresses as fillers to deploy the account
            extraAddrs = extraSigners.map(sign => sign.address);
            assert(extraAddrs.length > 2);

            //use the address of the previously deployed account in test 2
            await expect(bankConnTwo.deployAccount([extraAddrs[0], acctCreatedAddr, extraAddrs[1]]))
                .to.be.revertedWith("cannot be account address");

            //use the addresses of the wallet tied to the previous account
            await expect(bankConnTwo.deployAccount([walletAddresses[0], extraAddrs[1], extraAddrs[0]]))
                .to.be.revertedWith("cannot be a previous signer");
            await expect(bankConnTwo.deployAccount([extraAddrs[1], walletAddresses[1], extraAddrs[0]]))
                .to.be.revertedWith("cannot be a previous signer");
            await expect(bankConnTwo.deployAccount([extraAddrs[2], extraAddrs[0], walletAddresses[2]]))
                .to.be.revertedWith("cannot be a previous signer");
        });
    }); 
});