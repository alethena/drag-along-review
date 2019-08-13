const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const web3utils = require('web3-utils');
const BN = require('bn.js');
const exponent = new BN(18);

const increaseTime = require('../utilities/helpers').increaseTime;
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Claimable - Claim Tokens with XCHF', accounts => {
  let Draggable;
  let EQUITYInstance;
  let XCHFInstance;
  // let UpdatedContractInstance;

  const EQUITYMintAmount = new BN(10000);
  const EQUITYShareholder1MintAmount = new BN(9000);
  const EQUITYShareholder2MintAmount = new BN(1000);

  const XCHFMintAmount = toWei(1000000);

  const owner = accounts[0];
  const Shareholder1 = accounts[1];
  const Shareholder2 = accounts[2];
  const Tokenholder1 = accounts[3];
  const Tokenholder2 = accounts[4];
  const Tokenholder3 = accounts[5];
  const Tokenholder4 = accounts[6];
  const Tokenholder5 = accounts[7];
  const Tokenholder6 = accounts[8];

  beforeEach('Setup new environment', async function() {
    /**
     * Deploy instances of all involved contracts
     */
    XCHFInstance = await XCHF.new('Crypto Franc', new BN(0));
    EQUITYInstance = await EQUITY.new();
    await EQUITYInstance.setCustomClaimCollateral(XCHFInstance.address, toWei(1));
    Draggable = await DraggableShare.new(
      EQUITYInstance.address,
      XCHFInstance.address,
      '0x2189894c7F855430d5804a6D0d1F8aCeB0c75b81'
    );

    /**
     * Mint shares and XCHF
     */
    await EQUITYInstance.setTotalShares(EQUITYMintAmount);
    await Promise.all([
      EQUITYInstance.mint(Shareholder1, EQUITYShareholder1MintAmount),
      EQUITYInstance.mint(Shareholder2, EQUITYShareholder2MintAmount),
      XCHFInstance.mint(Shareholder1, XCHFMintAmount)
    ]);

    // Shareholder1 swaps some shares for draggable shares and distributes them
    await EQUITYInstance.approve(Draggable.address, 8000, {
      from: Shareholder1
    });

    await Promise.all([
      Draggable.wrap(Shareholder1, 5000, { from: Shareholder1 }),
      Draggable.wrap(Tokenholder1, 1000, { from: Shareholder1 }),
      Draggable.wrap(Tokenholder2, 1000, { from: Shareholder1 }),
      Draggable.wrap(Tokenholder3, 500, { from: Shareholder1 }),
      Draggable.wrap(Tokenholder4, 500, { from: Shareholder1 })
    ]);
  });

  it('Standard Claim Process with XCHF - Token level', async () => {
    // Shareholder1 claims the shares of Shareholder2
    const nonce = web3utils.sha3('Best nonce ever');
    const package = web3utils.soliditySha3(nonce, Shareholder1, Tokenholder1);
    const tx = await Draggable.prepareClaim(web3utils.toHex(package), {
      from: Shareholder1
    });

    const block = await web3.eth.getBlock('latest'); //.timestamp;

    // Check that data in struct is correct
    assert.equal(package, await Draggable.getMsgHash(Shareholder1));

    let temp = await Draggable.getPreClaimTimeStamp(Shareholder1);
    assert.equal(block.timestamp, temp);

    //Test events
    assert(tx.logs[0].event === 'ClaimPrepared', 'PreClaim event wrong');
    assert(
      Shareholder1 === tx.logs[0].args.claimer,
      'PreClaim address is incorrect'
    );

    const Tokenholder1Balance = await Draggable.balanceOf(Tokenholder1);
    const collateralRate = await Draggable.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Tokenholder1Balance.mul(collateralRate);
    await XCHFInstance.approve(Draggable.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    const tx2 = await Draggable.declareLost(
      XCHFInstance.address,
      Tokenholder1,
      nonce,
      {
        from: Shareholder1
      }
    );

    //Test events
    assert(tx2.logs[1].event === 'ClaimMade', 'ClaimMade event incorrect');
    assert(
      tx2.logs[1].args.lostAddress === Tokenholder1,
      'Claimed address is incorrect'
    );

    assert(
      tx2.logs[1].args.claimant === Shareholder1,
      'Claimer address is incorrect'
    );

    assert(
      tx2.logs[1].args.balance.eq(Tokenholder1Balance),
      'Claimed amount is incorrect'
    );

    const claimPeriod = await Draggable.claimPeriod();
    await increaseTime(claimPeriod.toNumber() + 5);

    const tx3 = await Draggable.resolveClaim(Tokenholder1, {
      from: Shareholder1
    });

    //Test events
    assert(tx3.logs[2].event === 'ClaimResolved', 'ClaimMade event incorrect');
    assert(
      tx3.logs[2].args.lostAddress === Tokenholder1,
      'Claimed address is incorrect'
    );

    assert(
      tx3.logs[2].args.claimant === Shareholder1,
      'Claimer address is incorrect'
    );

    assert(
      tx3.logs[2].args.collateral.eq(collateral),
      'Collateral address is incorrect'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
