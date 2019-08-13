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

contract('Claimable - Resolve Claim', accounts => {
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
    await EQUITYInstance.setCustomClaimCollateral(
      XCHFInstance.address,
      toWei(1)
    );
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

  it('Resolving claim works', async () => {
    // Shareholder1 claims the shares of Shareholder2
    const nonce = web3utils.sha3('Best nonce ever');
    const package = web3utils.soliditySha3(nonce, Shareholder1, Shareholder2);
    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
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
    const tx2 = await EQUITYInstance.declareLost(
      XCHFInstance.address,
      Shareholder2,
      nonce,
      { from: Shareholder1 }
    );

    const claimPeriod = await EQUITYInstance.claimPeriod();
    await increaseTime(claimPeriod.toNumber() + 5);

    const [
      Shareholder1BalanceBefore,
      Shareholder2BalanceBefore,
      contrXCHFBalanceBefore,
      Shareholder1XCHFBalanceBefore,
      Shareholder2XCHFBalanceBefore
    ] = await Promise.all([
      EQUITYInstance.balanceOf(Shareholder1),
      EQUITYInstance.balanceOf(Shareholder2),
      XCHFInstance.balanceOf(EQUITYInstance.address),
      XCHFInstance.balanceOf(Shareholder1),
      XCHFInstance.balanceOf(Shareholder2)
    ]);

    // Standard claim resolution works...
    const tx3 = await EQUITYInstance.resolveClaim(Shareholder2, {
      from: Shareholder1
    });

    const [
      Shareholder1BalanceAfter,
      Shareholder2BalanceAfter,
      contrXCHFBalanceAfter,
      Shareholder1XCHFBalanceAfter,
      Shareholder2XCHFBalanceAfter
    ] = await Promise.all([
      EQUITYInstance.balanceOf(Shareholder1),
      EQUITYInstance.balanceOf(Shareholder2),
      XCHFInstance.balanceOf(EQUITYInstance.address),
      XCHFInstance.balanceOf(Shareholder1),
      XCHFInstance.balanceOf(Shareholder2)
    ]);

    assert(
      Shareholder1BalanceAfter.eq(
        Shareholder1BalanceBefore.add(Shareholder2Balance)
      ),
      'Claimer equity balance incorrect'
    );
    assert(
      Shareholder2BalanceAfter.eq(
        Shareholder2BalanceBefore.sub(Shareholder2Balance)
      ),
      'Claimed address equity balance incorrect'
    );
    assert(
      contrXCHFBalanceAfter.eq(contrXCHFBalanceBefore.sub(collateral)),
      'Contract XCHF balance incorrect'
    );
    assert(
      Shareholder1XCHFBalanceAfter.eq(
        Shareholder1XCHFBalanceBefore.add(collateral)
      ),
      'Claimer XCHF balance incorrect'
    );
    assert(
      Shareholder2XCHFBalanceAfter.eq(Shareholder2XCHFBalanceBefore),
      'Claimed address XCHF balance incorrect'
    );

    // Events correct
    assert(tx3.logs[2].event === 'ClaimResolved', 'Claim event incorect');
    assert(
      tx3.logs[2].args.lostAddress === Shareholder2,
      'Claim event incorect'
    );
    assert(tx3.logs[2].args.claimant === Shareholder1, 'Claim event incorect');
    assert(tx3.logs[2].args.collateral.eq(collateral), 'Claim event incorect');
  });

  it("NEG - Can't resolve claim before claim period has ended", async () => {
    // Shareholder1 claims the shares of Shareholder2
    const nonce = web3utils.sha3('Best nonce ever');
    const package = web3utils.soliditySha3(nonce, Shareholder1, Shareholder2);
    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
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
    const tx2 = await EQUITYInstance.declareLost(
      XCHFInstance.address,
      Shareholder2,
      nonce,
      { from: Shareholder1 }
    );

    await shouldRevert(
      EQUITYInstance.resolveClaim(Shareholder2, {
        from: Shareholder1
      }),
      'Claim period not over yet'
    );

    const claimPeriod = await EQUITYInstance.claimPeriod();
    await increaseTime(claimPeriod.toNumber() + 5);

    await EQUITYInstance.resolveClaim(Shareholder2, {
      from: Shareholder1
    });
  });

  it('NEG - Only claimant can resolve claim', async () => {
    // Shareholder1 claims the shares of Shareholder2
    const nonce = web3utils.sha3('Best nonce ever');
    const package = web3utils.soliditySha3(nonce, Shareholder1, Shareholder2);
    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
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
    const tx2 = await EQUITYInstance.declareLost(
      XCHFInstance.address,
      Shareholder2,
      nonce,
      { from: Shareholder1 }
    );

    const claimPeriod = await EQUITYInstance.claimPeriod();
    await increaseTime(claimPeriod.toNumber() + 5);

    await shouldRevert(
      EQUITYInstance.resolveClaim(Shareholder2, {
        from: Tokenholder1
      }),
      'Only claimant can resolve claim'
    );
  });

  it("NEG - Can't resolve if there is no claim", async () => {
    // Shareholder1 claims the shares of Shareholder2
    const nonce = web3utils.sha3('Best nonce ever');
    const package = web3utils.soliditySha3(nonce, Shareholder1, Shareholder2);
    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
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
    const tx2 = await EQUITYInstance.declareLost(
      XCHFInstance.address,
      Shareholder2,
      nonce,
      { from: Shareholder1 }
    );

    const claimPeriod = await EQUITYInstance.claimPeriod();
    await increaseTime(claimPeriod.toNumber() + 5);

    await shouldRevert(
      EQUITYInstance.resolveClaim(Tokenholder2, {
        from: Shareholder1
      }),
      'No claim found'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
