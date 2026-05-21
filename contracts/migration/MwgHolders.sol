// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// AUTO-GENERATED from contracts/migration/mwg-holders.json by
// scripts/gen-holders-sol.js. Do not edit by hand.
// Source token: 0x84939fEc50EfdEDC8522917645AAfABFd5b3EA6F
// Snapshot block: 46267118
// Total supply:  100000000000000000000000
// Holder count:  2

library MwgHolders {
    uint256 internal constant TOTAL = 100000000000000000000000;
    uint256 internal constant COUNT = 2;

    function load() internal pure returns (address[] memory a, uint256[] memory v) {
        a = new address[](2);
        v = new uint256[](2);
        a[0] = 0x84D55C4BB3d4062f74F096Fcdf58E1A9d7405d95; v[0] = 60000000000000000000000;
        a[1] = 0x0920553CcA188871b146ee79f562B4Af46aB4f8a; v[1] = 40000000000000000000000;
    }
}
