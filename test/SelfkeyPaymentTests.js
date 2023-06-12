const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Selfkey Payment Tests", function () {

    let contract;
    let govContract;
    let usdcContract;

    let owner;
    let addr1;
    let addr2;
    let receiver;
    let signer;
    let addrs;

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const CREDENTIAL = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SK_KYC_CREDENTIAL'));
    const RECEIVER_WALLET_INDEX = 0;

    beforeEach(async function () {
        [owner, addr1, addr2, receiver, signer, ...addrs] = await ethers.getSigners();

        const totalSupply = (10 ** 9).toString();
        let usdcContractFactory = await ethers.getContractFactory("USDC");
        usdcContract = await usdcContractFactory.deploy(totalSupply);
        await usdcContract.deployed();

        const govContractFactory = await ethers.getContractFactory("SelfkeyGovernance");
        govContract = await upgrades.deployProxy(govContractFactory, []);
        await govContract.deployed();

        const paymentContractFactory = await ethers.getContractFactory("SelfkeyPaymentRegistry");
        contract = await upgrades.deployProxy(paymentContractFactory, []);
        await contract.deployed();

        await contract.connect(owner).setGovernanceContract(govContract.address, { from: owner.address });

        //await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
    });

    describe("Deployment", function() {
        it("Deployed correctly and governance function set", async function() {
            expect(await contract.governanceContractAddress())
                .to.equal(govContract.address);
        });
    });

    describe("Payment functions", function() {
        it("Can pay in native currency", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 100, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(0, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);

            expect(await contract.connect(addr1).pay(CREDENTIAL, { from:addr1.address, value: 100 }))
                .to.emit(govContract, 'CredentialPaid');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance).add( 100 );
            expect(`${balance}`).to.equal(`${totalBalance}`);
       });

       it("Can pay in native currency with decimals calculation", async function() {
        await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, ethers.utils.parseUnits(`10`, 18), true, true, 0, { from: owner.address }))
            .to.emit(govContract, 'PaymentCurrencyUpdated');

        const currency = await govContract.getCurrency(ZERO_ADDRESS);
        expect(currency[0]).to.equal("ETH");

        await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
        await govContract.connect(owner).setAddress(0, addr2.address, { from: owner.address });

        const prevBalance = await ethers.provider.getBalance(addr2.address);

        expect(await contract.connect(addr1).pay(CREDENTIAL, { from:addr1.address, value: ethers.utils.parseUnits(`10`, 18) }))
            .to.emit(govContract, 'CredentialPaid');

        const balance = await ethers.provider.getBalance(addr2.address);
        const totalBalance = ethers.BigNumber.from(prevBalance).add( ethers.utils.parseUnits(`10`, 18) );
        expect(`${balance}`).to.equal(`${totalBalance}`);
   });

       it("Cannot pay in native currency if value is below governance setting", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 100, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);

            await expect(contract.connect(addr1).pay(CREDENTIAL, { from:addr1.address, value: 10 }))
                .to.be.revertedWith('Selfkey Governance: invalid amount');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance);
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Cannot pay in native currency if governance global payment setting is off", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 100, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(false, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);

            await expect(contract.connect(addr1).pay(CREDENTIAL, { from:addr1.address, value: 10 }))
                .to.be.revertedWith('Selfkey Governance: payments are disabled');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance);
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Cannot pay in native currency if governance receiver address is not set", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 10, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            //await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);

            await expect(contract.connect(addr1).pay(CREDENTIAL, { from:addr1.address, value: 10 }))
                .to.be.revertedWith('Selfkey Governance: invalid treasury wallet');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance);
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Cannot pay in native currency if governance native currency is not set", async function() {

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);

            await expect(contract.connect(addr1).pay(CREDENTIAL, { from:addr1.address, value: 100 }))
                .to.be.revertedWith('Selfkey Governance: native payment not allowed');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance);
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });


        it("Cannot pay in native currency if governance native currency toggle is off", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 100, true, false, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);

            await expect(contract.connect(addr1).pay(CREDENTIAL, { from:addr1.address, value: 100 }))
                .to.be.revertedWith('Selfkey Governance: native payment not allowed');


            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance);
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Can pay in ERC20 currency", async function() {
            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, 50 * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, 10 * 10**6, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, 10, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            expect(await contract.connect(addr2).payToken(10, usdcContract.address, CREDENTIAL, { from:addr2.address }))
                .to.emit(govContract, 'CredentialPaid');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(10);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
        });

        it("Can pay in ERC20 currency with decimals calculation", async function() {
            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, 50 * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, 10 * 10**6, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, 10 * 10**6, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            expect(await contract.connect(addr2).payToken(10 * 10**6, usdcContract.address, CREDENTIAL, { from:addr2.address }))
                .to.emit(govContract, 'CredentialPaid');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(10 * 10**6);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
        });

        it("Can not pay in ERC20 currency if value is below governance setting", async function() {
            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, 50 * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, 10 * 10**6, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, 10 * 10**6, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            await expect(contract.connect(addr2).payToken(9 * 10**6, usdcContract.address, CREDENTIAL, { from:addr2.address }))
                .to.be.revertedWith('Selfkey Governance: invalid amount');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
            expect(await usdcContract.connect(owner).balanceOf(addr2.address, { from: owner.address })).to.equal(50 * 10**6);
        })

    });


});
