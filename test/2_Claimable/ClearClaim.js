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

contract('Claimable - Clear Claim', accounts => {
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

  it('Clearing claims works', async () => {
    // Shareholder1 claims the shares of Shareholder2
    const nonce = web3utils.sha3('Best nonce ever');
    const package = web3utils.soliditySha3(nonce, Shareholder1, Shareholder2);
    const tx = await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
      from: Shareholder1
    });

    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    tx2 = await EQUITYInstance.declareLost(
      XCHFInstance.address,
      Shareholder2,
      nonce,
      { from: Shareholder1 }
    );

    const Shareholder1XCHFBalanceBefore = await XCHFInstance.balanceOf(
      Shareholder1
    );
    const Shareholder2XCHFBalanceBefore = await XCHFInstance.balanceOf(
      Shareholder2
    );

    await EQUITYInstance.clearClaim({ from: Shareholder2 });

    const Shareholder1XCHFBalanceAfter = await XCHFInstance.balanceOf(
      Shareholder1
    );
    const Shareholder2XCHFBalanceAfter = await XCHFInstance.balanceOf(
      Shareholder2
    );
    // Make sure claimer's money goes to the rightful owner
    assert(
      Shareholder1XCHFBalanceBefore.eq(Shareholder1XCHFBalanceAfter),
      'Wrongful claimer got collateral back'
    );
    assert(
      Shareholder2XCHFBalanceAfter.eq(
        Shareholder2XCHFBalanceBefore.add(collateral)
      ),
      'Rightful owner got incorrect collateral back'
    );
  });

  it('NEG - Nothing happens when calling clear claim without an active claim', async () => {
    const tx = await EQUITYInstance.clearClaim({ from: Shareholder2 });
    assert(!tx.logs[0], "An unintended side efect was triggered");
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
