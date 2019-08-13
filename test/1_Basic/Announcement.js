const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const BN = require('bn.js');
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Basic - Announcement', accounts => {
  let EQUITYInstance;
  let XCHFInstance;
  const Tokenholder1 = accounts[3];

  beforeEach('Setup new environment', async function() {
    /**
     * Deploy instances of all involved contracts
     */
    XCHFInstance = await XCHF.new('Crypto Franc', new BN(0));
    EQUITYInstance = await EQUITY.new();

    Draggable = await DraggableShare.new(
      EQUITYInstance.address,
      XCHFInstance.address,
      '0x2189894c7F855430d5804a6D0d1F8aCeB0c75b81'
    );
  });

  it('Owner can make announcement', async () => {
    const tx = await EQUITYInstance.announcement(
      'A message so important it needs to be picked up by every Ethereum node in the world!'
    );
    assert(tx.logs[0].event === 'Announcement');
    assert(
      tx.logs[0].args.message ===
        'A message so important it needs to be picked up by every Ethereum node in the world!'
    );
  });

  it('NEG - Only owner can make announcement', async () => {
    await shouldRevert(
      EQUITYInstance.announcement(
        'A message so important it needs to be picked up by every Ethereum node in the world!',
        { from: Tokenholder1 }
      ),
      'You are not the owner of this contract'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
