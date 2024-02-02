const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Selfkey Payment Tests", function () {

    let contract;
    let govContract;
    let usdcContract;

    let owner;
    let addr1;
    let addr2;
    let addr3;
    let receiver;
    let signer;
    let addrs;

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const CREDENTIAL = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SK_KYC_CREDENTIAL'));
    const RECEIVER_WALLET_INDEX = 0;

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, receiver, signer, ...addrs] = await ethers.getSigners();

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
            expect(await contract.governanceContractAddress()).to.equal(govContract.address);
        });
    });


    describe("Upgradeability", function() {
        it("Should upgrade correctly", async function() {
            [owner, addr1, addr2, receiver, signer, ...addrs] = await ethers.getSigners();

            let factory = await ethers.getContractFactory("SelfkeyPaymentRegistryV1");
            let contract2 = await upgrades.deployProxy(factory, []);
            await contract2.deployed();

            await contract2.connect(owner).setGovernanceContract(govContract.address, { from: owner.address });

            let factory2 = await ethers.getContractFactory("SelfkeyPaymentRegistry");
            const upgradedContract = await upgrades.upgradeProxy(contract.address, factory2);

            expect(await upgradedContract.governanceContractAddress())
                .to.equal(govContract.address);
        });
    });

    describe("Simple Payment Scenario", function() {
        it("Can pay in native currency", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 100, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(0, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);
            const coupon = '';
            expect(await contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 100 }))
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
            const coupon = '';
            expect(await contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: ethers.utils.parseUnits(`10`, 18) }))
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
            const coupon = '';
            await expect(contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 10 }))
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
            const coupon = '';
            await expect(contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 10 }))
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
            const coupon = '';
            await expect(contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 10 }))
                .to.be.revertedWith('Selfkey Governance: invalid treasury wallet');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance);
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Cannot pay in native currency if governance native currency is not set", async function() {

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);
            const coupon = '';
            await expect(contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 100 }))
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
            const coupon = '';
            await expect(contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 100 }))
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
            const coupon = '';
            expect(await contract.connect(addr2).payToken(10, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
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

            const coupon = '';
            expect(await contract.connect(addr2).payToken(10 * 10**6, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
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

            const coupon = '';
            await expect(contract.connect(addr2).payToken(9 * 10**6, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
                .to.be.revertedWith('Selfkey Governance: invalid amount');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
            expect(await usdcContract.connect(owner).balanceOf(addr2.address, { from: owner.address })).to.equal(50 * 10**6);
        })
    });

    describe("Payment with Coupons Scenario", function() {
        it("Can pay in ETH with Coupon", async function() {
            const amount = 200;
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, amount, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const discount = 30;
            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _amount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, discount, 0, true, ZERO_ADDRESS, ZERO_ADDRESS, 0, { from: owner.address });

            // Expected discount amount
            const expectedAmount = amount - (amount * discount / 100);

            const prevBalance = await ethers.provider.getBalance(addr2.address);
            expect(await contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: expectedAmount }))
                .to.emit(govContract, 'CredentialPaid');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance).add( expectedAmount );
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Cannot pay in ETH with Coupon if wrong amount", async function() {
            const amount = 500;
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, amount, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const discount = 12;
            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _amount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, discount, 0, true, ZERO_ADDRESS, ZERO_ADDRESS, 0, { from: owner.address });

            // Expected discount invalid amount
            const expectedInvalidAmount = amount - (amount * 40 / 100);

            const prevBalance = await ethers.provider.getBalance(addr2.address);
            await expect( contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: expectedInvalidAmount }))
                .to.be.revertedWith('Selfkey Governance: invalid amount');
        });

        it("Can pay in ERC20 currency with Coupon", async function() {
            const amount = 70;
            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, amount * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, amount * 10**6, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, amount * 10**6, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            const discount = 40;
            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _amount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, discount, 0, true, ZERO_ADDRESS, ZERO_ADDRESS, 0, { from: owner.address });

            // Expected discount amount
            //const amountWithDecimals = amount * 10**6;
            const expectedAmount = 42 * 10**6;
            expect(await contract.connect(addr2).payToken(expectedAmount, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
                .to.emit(govContract, 'CredentialPaid');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(expectedAmount);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
        });

        it("Cannot pay in ERC20 currency with pct coupon if wrong amount", async function() {
            const amount = 170;
            const amountInDecimals = amount * 10**6;
            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, amountInDecimals, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, amountInDecimals, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, amountInDecimals, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            const discount = 40;
            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, discount, 0, true, ZERO_ADDRESS, ZERO_ADDRESS, 0, { from: owner.address });

            // Expected discount amount
            const expectedInvalidAmount = amountInDecimals - (amountInDecimals * 60 / 100);
            await expect(contract.connect(addr2).payToken(expectedInvalidAmount, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
                .to.be.revertedWith('Selfkey Governance: invalid amount');
        });

        it("Can pay if coupon is for a wallet", async function() {
            const amount = 38;
            const amountWithDecimals = amount * 10**6;
            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, 50 * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, amountWithDecimals, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, amountWithDecimals, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            const discount = 33;
            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _amount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, discount, 0, true, addr2.address, ZERO_ADDRESS, 0, { from: owner.address });

            const expectedAmount = amountWithDecimals - (amountWithDecimals * discount / 100);
            expect(await contract.connect(addr2).payToken(expectedAmount, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
                .to.emit(govContract, 'CredentialPaid');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(expectedAmount);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
            expect(await usdcContract.connect(owner).balanceOf(addr2.address, { from: owner.address })).to.equal(50 * 10**6 - expectedAmount);
        });

        it("Cannot pay if coupon is for a wallet with wrong wallet", async function() {
            const amount = 38;
            const amountWithDecimals = amount * 10**6;
            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, 50 * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, amountWithDecimals, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, amountWithDecimals, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            const discount = 33;
            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, discount, 0, true, addr3.address, ZERO_ADDRESS, 0, { from: owner.address });

            const expectedAmount = amountWithDecimals - (amountWithDecimals * discount / 100);
            await expect(contract.connect(addr2).payToken(expectedAmount, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
                .to.be.revertedWith('Selfkey Governance: invalid amount');
        });

        it("Payment fails if coupon is not active", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 100, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, 25, 0, false, ZERO_ADDRESS, ZERO_ADDRESS, 0, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);
            await expect(contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 25 }))
                .to.be.revertedWith('Selfkey Governance: invalid amount');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance).add( 0 );

            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Can pay in ERC20 with Coupon and Affiliate fee is shared", async function() {
            const amount = 22;
            const amountWithDecimals = amount * 10**6;

            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, 50 * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, amountWithDecimals, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, amountWithDecimals, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            const discount = 23;
            const fee = 40;
            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _amount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, discount, 0, true, ZERO_ADDRESS, addr3.address, fee, { from: owner.address });

            const expectedAmount = amountWithDecimals - (amountWithDecimals * discount / 100);
            expect(await contract.connect(addr2).payToken(expectedAmount, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
                .to.emit(govContract, 'CredentialPaid');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(expectedAmount * 0.6);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
            expect(await usdcContract.connect(owner).balanceOf(addr3.address, { from: owner.address })).to.equal(expectedAmount * 0.4);
        });

        it("Can pay in ETH with 100% discount coupon", async function() {
            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, 100, true, true, 0, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr2.address, { from: owner.address });

            const coupon = 'SK_KYC_COUPON';
            // (_coupon, _discount, _expiry, _active, _wallet, _affiliateWallet, _affiliateShare)
            await govContract.connect(owner).setCoupon(coupon, 100, 0, true, ZERO_ADDRESS, ZERO_ADDRESS, 0, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);
            expect(await contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: 0 }))
                .to.emit(govContract, 'CredentialPaid');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance).add( 0 );
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

    });



    describe("Discounts", function() {
        it("Can pay in native currency with global discount", async function() {
            const amount = 12;
            const amountWithDecimals = amount * 10**6;
            const discount = 22;

            await expect(govContract.connect(owner).updatePaymentCurrency("ETH", ZERO_ADDRESS, 18, amountWithDecimals, true, true, discount, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(ZERO_ADDRESS);
            expect(currency[0]).to.equal("ETH");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(0, addr2.address, { from: owner.address });

            const prevBalance = await ethers.provider.getBalance(addr2.address);

            const coupon = '';
            const expectedAmount = amountWithDecimals - (amountWithDecimals * discount / 100);
            expect(await contract.connect(addr1).pay(CREDENTIAL, coupon, { from:addr1.address, value: expectedAmount }))
                .to.emit(govContract, 'CredentialPaid');

            const balance = await ethers.provider.getBalance(addr2.address);
            const totalBalance = ethers.BigNumber.from(prevBalance).add( expectedAmount );
            expect(`${balance}`).to.equal(`${totalBalance}`);
        });

        it("Can pay in ERC20 currency with discount", async function() {
            const amount = 2;
            const amountWithDecimals = amount * 10**6;
            const discount = 38;

            // Transfer some USDC
            await usdcContract.connect(owner).transfer(addr2.address, 50 * 10**6, { from: owner.address });
            // Approve USDC spending
            await usdcContract.connect(addr2).approve(contract.address, amountWithDecimals, { from: addr2.address});
            // Confirm receiver wallet has 0 USDC
            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(0);

            await expect(govContract.connect(owner).updatePaymentCurrency("USDC", usdcContract.address, 6, amountWithDecimals, true, true, discount, { from: owner.address }))
                .to.emit(govContract, 'PaymentCurrencyUpdated');

            const currency = await govContract.getCurrency(usdcContract.address);
            expect(currency[0]).to.equal("USDC");

            await govContract.connect(owner).setEntryFreeStatus(true, { from: owner.address });
            await govContract.connect(owner).setAddress(RECEIVER_WALLET_INDEX, addr1.address, { from: owner.address });

            const coupon = '';
            const expectedAmount = amountWithDecimals - (amountWithDecimals * discount / 100);
            expect(await contract.connect(addr2).payToken(expectedAmount, usdcContract.address, CREDENTIAL, coupon, { from:addr2.address }))
                .to.emit(govContract, 'CredentialPaid');

            expect(await usdcContract.connect(owner).balanceOf(addr1.address, { from: owner.address })).to.equal(expectedAmount);
            expect(await usdcContract.connect(owner).balanceOf(contract.address, { from: owner.address })).to.equal(0);
        });
    });

});
