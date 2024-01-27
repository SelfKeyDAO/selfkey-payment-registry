// SPDX-License-Identifier: proprietary
pragma solidity 0.8.19;

struct PaymentCurrency {
    string name;
    address tokenAddress;
    uint8 decimals;
    uint256 amount;
    bool native;
    bool active;
    uint256 discount;
}

struct Coupons {
    string coupon;
    uint256 discount;
    uint256 amount;
    uint256 expiry;
    bool active;
    address wallet;
    address affiliateWallet;
    uint256 affiliateShare;
}

interface ISelfkeyGovernance {

    event EntryFeeStatusUpdated(bool _status);
    event PaymentCurrencyUpdated(string _name, address indexed _tokenAddress, uint8 _decimals, uint256 _amount, bool _native, bool _active, uint256 _discount);
    event AddressUpdated(address owner, uint256 indexed index, address oldValue, address newValue);
    event NumberUpdated(address owner, uint256 indexed index, uint256 oldValue, uint256 newValue);
    event DataUpdated(address owner, uint256 indexed index, bytes32 oldValue, bytes32 newValue);

    function entryFeeStatus() external view returns (bool);
    function addresses(uint256 _index) external view returns(address);
    function numbers(uint256 _index) external view returns(uint256);
    function data(uint256 _index) external view returns(bytes32);
    function setEntryFreeStatus(bool _status) external;
    function updatePaymentCurrency(string memory _name, address _tokenAddress, uint8 _decimals, uint256 _amount, bool _native, bool _active, uint256 _discount) external;
    function getCurrencies() external view returns (PaymentCurrency[] memory);
    function getCurrency(address _tokenAddress) external view returns (PaymentCurrency memory);
    function setAddress(uint256 addressIndex, address newAddress) external;
    function setNumber(uint256 index, uint256 newNumber) external;
    function setData(uint256 index, bytes32 newData) external;
    function setCoupon(string memory _coupon, uint256 _discount, uint256 _amount, uint256 _expiry, bool _active, address _wallet, address _affiliateWallet, uint256 _affiliateShare) external;
    function getCoupon(string memory _coupon) external view returns (Coupons memory);
    function removeCoupon(string memory _coupon) external;
    function getValidCoupon(string memory _coupon, address _wallet) external view returns (Coupons memory);
}
