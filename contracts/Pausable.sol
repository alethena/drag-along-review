pragma solidity ^0.5.10;

import "./Ownable.sol";


contract Pausable is Ownable {

    /** This contract is pausable.  */
    bool public paused = false;

    /** @dev Function to set pause.
     * This could for example be used in case of a fork of the network, in which case all
     * "wrong" forked contracts should be paused in their respective fork. Deciding which
     * fork is the "right" one is up to the owner of the contract.
     */
    function pause(bool _pause, string memory _message, address _newAddress, uint256 _fromBlock) public onlyOwner() {
        paused = _pause;
        emit Pause(_pause, _message, _newAddress, _fromBlock);
    }

    event Pause(bool paused, string message, address newAddress, uint256 fromBlock);
}