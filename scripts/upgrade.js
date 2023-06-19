const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const proxyAddress = "0xBCc5E951fEd05b660039cABF077a027Bb1dF018c";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyPaymentRegistry");
    const contract = await upgrades.upgradeProxy(proxyAddress, contractFactory);
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);


    // INFO: verify contract after deployment
    // npx hardhat verify --network mumbai 0xBCc5E951fEd05b660039cABF077a027Bb1dF018c
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
