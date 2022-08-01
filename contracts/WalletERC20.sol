// contracts/Wallet.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Wallet.sol";

//contract for interoperability with the ERC-20 standard
contract WalletERC20 is Wallet {
    bool public ercInitialized;
    address public tokenContract;

    // check that the wallet is ready to create a transaction
    modifier ercReady() {
        require(ercInitialized, "no erc contract set");
        _;
    }

    //ensure that the contract has enough ERC 20 to send
    modifier hasFunds(uint256 _amount) {
        bytes4 selector = bytes4(keccak256("balanceOf(address)"));
        (bool success, bytes memory data) = tokenContract.call(abi.encodeWithSelector(selector, address(this)));
        require(success, "balance unavailable");

        uint256 value = abi.decode(data, (uint256));
        require(value >= _amount, "not enough funds");
        _;
    }

    constructor(address[3] memory _signers) Wallet(_signers){
        ercInitialized = false;
    }

    // set the tokenContract to be the one of 
    function setToken(address tokenAddr) 
        external
        onlyApprover
    {
        tokenContract = tokenAddr;
        ercInitialized = true;
    }

    //get the contract of the current ERC 20 we are interacting with
    function getTokenAddress() 
        public
        view 
        ercReady
        returns (address)
    {
        return tokenContract;
    }

    // create a pending transaction that transfers ERC-20 tokens
    function createERC20Transfer(address to, uint256 amount) 
        public
        onlyApprover
        ercReady
        hasFunds(amount)
    {
        bytes4 selector = bytes4(keccak256("transfer(address,uint256)"));
        bytes memory data = abi.encodeWithSelector(selector, to, amount);

        //create a transaction that will need confirmation
        createTransaction(tokenContract, 0, data);
    }

}