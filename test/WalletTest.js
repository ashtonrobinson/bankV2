const { expect, assert } = require('chai');
const { ethers, waffle } = require("hardhat");
const hre = require('hardhat');

// testing suite for Account.sol
describe("Wallet Contract Testing Suite", function () {
    let provider;
    // variables used in testing suite created in before and beforeEach 
    let WalletFactory;
    let Wallet; 
    let owner;
    // list of signer objects
    let signers;
    // list of 3 signer objects that are the approvers of the wallet
    let approvers;
    // addresses of the 3 approvers
    let addresses;

    // the balance after ether has been recieved to the wallet
    let balanceAfter;

    // create the contract factory before anything runs
    before(async function () {
        provider = waffle.provider;

        WalletFactory = await ethers.getContractFactory('Wallet');
        // pull out owners to test contract with
        [owner, ...signers] = await ethers.getSigners();

        addresses = new Array();
        approvers = new Array();

        const indicies = hre.chooseThree(signers.length);
        for(const index of indicies) {
            const appr = signers[index]
            approvers.push(appr);
            addresses.push(appr.address);
        }

        Wallet = await WalletFactory.deploy(addresses);
        await Wallet.deployed();
    });

    // correctly check that approvers is of length 3 and has the correct addresses
    describe("Deployment", function () {
        //test 1, correct approvers
        it('correct address approvers', async function () {
            // only three approvers allowed
            expect(await Wallet.getApprovers()).to.have.members(addresses);
            expect(await Wallet.getApprovers()).to.have.length(3);
        });

        //correct owner(deployer of the contract)
        it('correct deployer of the contract', async function () {
            expect(await Wallet.owner()).to.equal(owner.address);
        })

        //test 2, correct balance of zero on deployment
        it('correct balance', async function () {
            expect(await provider.getBalance(Wallet.address)).to.equal(0);
        });
    });

    describe("Incorrect Deployment", function () {
        // test invalid creation
        it('zero approvers', async function () {
            await expect(WalletFactory.deploy()).to.be.reverted;
        });

        // length of approvers is smaller
        it('one signer', async function () {
            let signer = signers[0];
            let address = signer.address;

            await expect(WalletFactory.deploy([address])).to.be.reverted;
        });

        // length of approvers is larger
        it('five signers', async function () {
            let addres = signers.slice(5).map(sign => sign.address);

            await expect(WalletFactory.deploy(addres)).to.be.reverted;
        });

        //duplicate approvers
        it('duplicate approvers', async function () {
            let signerOne = signers[0];
            let signerTwo = signers[1];

            let addr1 = signerOne.address;
            let addr2 = signerTwo.address;

            await expect(WalletFactory.deploy([addr2, addr1, addr2])).to.be.revertedWith("approver not unique");
        });

        // cannot use the zero address to create a wallet
        it('approver is the zero address', async function () {
            let signerOne = signers[0];
            let signerTwo = signers[1];

            let addr1 = signerOne.address;
            let addr2 = signerTwo.address;

            await expect(WalletFactory.deploy([addr1, addr2, "0x0000000000000000000000000000000000000000"]))
                .to.be.revertedWith("invalid approver");
        })
    });

    // recieve ether and emit an event
    describe("Receiving Ether", function () {
        let walletAddr;
        let balanceBefore;

        before(async function () {
            walletAddr = Wallet.address;
        });

        beforeEach(async function () {
            balanceBefore = await provider.getBalance(walletAddr);
        });

        // asserts that the balance is non zero before attempting to create transactions
        after(async function () {
            balanceAfter = await provider.getBalance(Wallet.address);
            assert(balanceAfter > 0);
        });

        //test 1, recieving ether from owner, no ether in contract
        it('deployer sent 1 ether to contract', async function () {
            let txn = {to: walletAddr, value: ethers.utils.parseEther('1.0')};

            // confirm the event was recieved
            await expect(owner.sendTransaction(txn)).to.emit(Wallet, "Deposit")
                .withArgs(owner.address, ethers.utils.parseEther('1.0'));

            //check that the balance of the account is correct
            expect(await provider.getBalance(walletAddr)).to.equal(balanceBefore.add(ethers.utils.parseEther('1.0')));
        });

        //test 2, approver sent zero eth
        it('approver sent 0 ether to contract', async function () {
            txn = {to: walletAddr, value: 0};

            const approverOne = approvers[0];

            //no event should be triggered
            await approverOne.sendTransaction(txn);
            expect(await provider.getBalance(walletAddr)).to.equal(balanceBefore);
        });

        //test 3, multiple random addresses sending ether repeatedly
        it('recieve from random addresses', async function () {
            value1 = ethers.utils.parseEther('0.009');
            value2 = ethers.utils.parseEther('0.8');
            value3 = ethers.utils.parseEther('20.0');
            txn1 = {to: walletAddr, value: value1};
            txn2 = {to: walletAddr, value: value2};
            txn3 = {to: walletAddr, value: value3};

            const randomSingers = signers.filter(sign => !approvers.includes(sign) && sign != owner);

            await expect(randomSingers[0].sendTransaction(txn1)).to.emit(Wallet, "Deposit")
                .withArgs(randomSingers[0].address, value1);
            await expect(randomSingers[1].sendTransaction(txn2)).to.emit(Wallet, "Deposit")
                .withArgs(randomSingers[1].address, value2);
            await expect(randomSingers[2].sendTransaction(txn3)).to.emit(Wallet, "Deposit")
                .withArgs(randomSingers[2].address, value3);

            expect(await provider.getBalance(walletAddr)).to.equal(balanceBefore.add(value1).add(value2).add(value3));
        });   
    });

    // correctly create a transaction
    describe("Transaction Creation from Approver", function () {
        let approver;
        let connection;
    
        // assign an approver to initiate the transaction
        beforeEach(async function () {
            approver = approvers[Math.floor(Math.random()*3)];
            connection = await Wallet.connect(approver);
        });

        // reset after each test so that there is no pending txn
        afterEach(async function () {
            if (await Wallet.hasPendingTransaction()){
                await expect(connection.revokePendingTransaction()).to.emit(Wallet, "RevokePendingTransaction")
                    .withArgs(approver.address);
            }
        });

        //test 1, transaction request from the approver when wallet has a balance
        it('correct creation, no double requests', async function () {
            //randomly pick an address
            to = signers[Math.floor(Math.random()*(signers.length))].address;
            // send a small amount
            value = ethers.utils.parseEther('1');
            data = "0x";

            await expect(connection.createTransaction(to, value, "0x")).to.emit(Wallet, "SubmitTransaction")
                .withArgs(approver.address, to, value, data);
            
            expect(await Wallet.hasPendingTransaction()).to.be.true;

            //attempt to create the same transaction again, should revert
            await expect(connection.createTransaction(to, value, "0x")).to.be.revertedWith("pending txn exists already");
        });

        // test 2, approver creates the request with bad values
        it('value greater than acct balance, value = 0, value equal to balance', async function () {
            //randomly pick an address
            to = signers[Math.floor(Math.random()*(signers.length))].address;
            data = "0x"; 

            //first try with a value of zero
            await expect(connection.createTransaction(to, 0, data)).to.be.revertedWith("cannot send nothing");

            // use current balance to query a value greaters
            currBalance = await provider.getBalance(Wallet.address);
            value = currBalance.add(ethers.utils.parseEther('1'));

             //first try with a value of zero
            await expect(connection.createTransaction(to, value, data)).to.be.revertedWith("contract needs more funds");

            //finally query correctly with the entire account balance
            await expect(connection.createTransaction(to, currBalance, data)).to.emit(Wallet, "SubmitTransaction")
                .withArgs(approver.address, to, currBalance, data);

        });

        //test 3, approver attempts to send to incorrect addressses
        it('invalid addresses', async function () {
            // pick invalis address
            value = ethers.utils.parseEther('1');
            data = '0x';

            //try to send funds back to the contract
            to = Wallet.address;
            await expect(connection.createTransaction(to, value, data)).to.be.revertedWith("cannot send to contract's address");

            //zero address
            to = "0x0000000000000000000000000000000000000000";
            await expect(connection.createTransaction(to, value, data)).to.be.revertedWith("cannot send to null address");

            //owner address, cannot send here since funds are forwarded from the owners recieve()
            to = owner.address;
            await expect(connection.createTransaction(to, value, data)).to.be.revertedWith("cannot send to creator of this wallet");
        });

    });

    describe("Transaction creation from Non-Approver", function () {
        //test 1, use a non approver to attempt to make a request
        it('non-approver, valid information', async function () {
            //retrieve a signer that is not an apporver not owner
            signer = signers.filter(sign => !approvers.includes(sign) && sign != owner)[0];
            connection = await Wallet.connect(signer);

            await expect(connection.createTransaction(signer.address, ethers.utils.parseEther('1'), "0x"))
                .to.be.revertedWith("not approver");
        });
    });

    describe("Transaction execution, existing transaction", function () {
        let confirmer;
        let confirmerConnection;
        let creator;
        let creatorConnection;
        let balanceBefore;

        before(async function () {
            // ensures that the contract has funds to send
            assert(await provider.getBalance(Wallet.address) > 0);
        })

        // intiate a transaction
        beforeEach(async function () {
            creator = approvers[Math.floor(Math.random()*3)];
            creatorConnection = await Wallet.connect(creator);

            // random signer from [1:], ommitting the owner of the contract
            to = signers[Math.floor(1 + Math.random()*(signers.length-1))];

            amount = ethers.utils.parseEther('1');
            data = "0x"

            //submit a correct transaction
            await creatorConnection.createTransaction(to.address, amount, data);

            confirmer = approvers.filter(app => app != creator)[Math.floor(Math.random()*2)];
            confirmerConnection = await Wallet.connect(confirmer);

            balanceBefore = await provider.getBalance(Wallet.address);
        });

        // remove the pending transaction if there is one from the creator
        afterEach(async function () {
            if (await Wallet.hasPendingTransaction()){
                await expect(creatorConnection.revokePendingTransaction()).to.emit(Wallet, "RevokePendingTransaction")
                    .withArgs(creator.address);
            }
        });

        // test 1
        it("revoke transactoin from the confirmer", async function () {
            await expect(confirmerConnection.revokePendingTransaction()).to.be.revertedWith("only the creator can revoke the pending txn");
        });

        //test 2, not from creator followed by an approved transaction
        it("no creator confirmation, second approver succeed", async function () {
            //attempt to confirm from the creator address
            await expect(creatorConnection.confirmAndExecuteTransaction()).to.be.revertedWith("creator cannot confirm and execute");

            //now confirm the message from the confirmer
            await expect(confirmerConnection.confirmAndExecuteTransaction()).to.emit(Wallet, "TransactionExecuted")
                .withArgs(confirmer.address);

            expect(await provider.getBalance(Wallet.address)).to.equal(balanceBefore.sub(ethers.utils.parseEther('1')));
            expect(await Wallet.hasPendingTransaction()).to.be.false;
        });

        it('non approver', async function () {
            //submit from the owner as this is not an approver
            ownerConnection = await Wallet.connect(owner);

            await expect(ownerConnection.confirmAndExecuteTransaction()).to.be.revertedWith("not approver");

            expect(await provider.getBalance(Wallet.address)).to.equal(balanceBefore);
            expect(await Wallet.hasPendingTransaction()).to.be.true;
        });
    });
});