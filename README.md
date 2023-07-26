# Selfkey Payments Registry contract

## Overview
Payments registry for Selfkey.ID

## Development

All smart contracts are implemented in Solidity `^0.8.19`, using [Hardhat](https://hardhat.org/) as the Solidity development framework.

### Prerequisites

* [NodeJS](htps://nodejs.org), v16.1.0+
* [Hardhat](https://hardhat.org/), which is a comprehensive framework for Ethereum development.

### Initialization

    `npm install`

### Testing

    `npx hardhat test`

### Deploy

    `npx hardhat run scripts/deploy.js --network mumbai`
    `npx hardhat verify --network mumbai 0xBCc5E951fEd05b660039cABF077a027Bb1dF018c`

### Propose upgrade

    `npx hardhat run scripts/propose_upgrade.js --network mumbai`
