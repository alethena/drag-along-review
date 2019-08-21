pragma solidity 0.5.10;


contract IMigratable {
    function migrationToContract() public returns (address);
}
