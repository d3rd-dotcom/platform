/**
 * Turns the read-only snapshot (contracts/migration/mwg-holders.json) into a
 * Solidity data file (contracts/migration/MwgHolders.sol) so the Foundry
 * migration script can mint exact balances without fragile JSON parsing.
 *
 * Usage: node scripts/gen-holders-sol.js   (run after snapshot-mwg-holders.js)
 */
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'contracts', 'migration', 'mwg-holders.json');
const outPath = path.join(__dirname, '..', 'contracts', 'migration', 'MwgHolders.sol');

const snap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const holders = snap.holders;

const lines = holders.map(
  (h, i) => `        a[${i}] = ${h.address}; v[${i}] = ${h.amount};`
).join('\n');

const sol = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// AUTO-GENERATED from contracts/migration/mwg-holders.json by
// scripts/gen-holders-sol.js. Do not edit by hand.
// Source token: ${snap.token}
// Snapshot block: ${snap.snapshotBlock}
// Total supply:  ${snap.totalSupply}
// Holder count:  ${snap.holderCount}

library MwgHolders {
    uint256 internal constant TOTAL = ${snap.reconstructedSum};
    uint256 internal constant COUNT = ${holders.length};

    function load() internal pure returns (address[] memory a, uint256[] memory v) {
        a = new address[](${holders.length});
        v = new uint256[](${holders.length});
${lines}
    }
}
`;

fs.writeFileSync(outPath, sol);
console.log(`Wrote ${outPath} (${holders.length} holders, total ${snap.reconstructedSum})`);
