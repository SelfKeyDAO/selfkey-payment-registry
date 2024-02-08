const { ethers, upgrades } = require('hardhat');

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const proxyAddress = "0x5a2010A5137bE1A02A2E02E25d7172aee07A4831";

    const contractFactory = await hre.ethers.getContractFactory("SelfkeyPaymentRegistry");
    const contract = await upgrades.upgradeProxy(proxyAddress, contractFactory, { timeout: 500000 });
    await contract.deployed();

    console.log("Deployed contract address:", contract.address);

    // INFO: verify contract after deployment
    // npx hardhat verify --network polygon 0x5a2010A5137bE1A02A2E02E25d7172aee07A4831
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
