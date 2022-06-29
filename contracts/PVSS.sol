// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PVSS {
    address[] public committeeAddresses;
    mapping(address => uint256) public committeePKs;

    mapping(address => bool) public committeeHasAddress;
    uint256 public remainingPKsToSet;
    mapping(address => bool) public committeeMemberSetPK;

    constructor(address[] memory _committeeAddresses) {
        committeeAddresses = _committeeAddresses;

        for (uint256 i = 0; i < committeeAddresses.length; i++) {
            committeeHasAddress[committeeAddresses[i]] = true;
        }
        remainingPKsToSet = committeeAddresses.length;
    }

    function sharePK(uint256 pk) public {
        require(
            committeeHasAddress[msg.sender],
            "msg.sender does not belong to committee"
        );
        committeePKs[msg.sender] = pk;
        if (!committeeMemberSetPK[msg.sender]) {
            --remainingPKsToSet;
            committeeMemberSetPK[msg.sender] = true;
        }
    }
}
