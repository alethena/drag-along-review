
pragma solidity ^0.5.10;


import "../../ERC20.sol";

contract UpdatedContract is ERC20 {

    function mint(address receiver, uint256 amount) public {
        _mint(receiver, amount);
    }

    function setApprovals(address oldAddress, uint256 amount) public {
        ERC20 oldContract = ERC20(oldAddress);
        oldContract.approve(oldAddress, amount);
        approve(oldAddress, amount);
    }

    function migrate(address oldAddress) public {
        IMigratable oldContract = IMigratable(oldAddress);
        oldContract.migrate();
    }
}

contract IMigratable {
    function migrate() public;
}
