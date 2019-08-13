const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');
const ALEQ = artifacts.require('../contracts/ServiceHunterShares.sol');
const DragAlongToken = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

module.exports = function(deployer) {
  deployer
    .deploy(XCHF, 'XCHF', 0)
    .then(() => {
      return deployer.deploy(ALEQ, XCHF.address);
    })
    .then(() => {
      return deployer.deploy(
        DragAlongToken,
        ALEQ.address,
        XCHF.address,
        '0x8dD722E1207FD4156d447c4E3372ffe1Bc8bac91'
      );
    });
};
