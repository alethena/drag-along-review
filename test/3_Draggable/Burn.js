const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const BN = require('bn.js');
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Draggable - Burn', accounts => {
  let Draggable;
  let EQUITYInstance;
  let XCHFInstance;

  const EQUITYMintAmount = new BN(10000);
  const EQUITYShareholder1MintAmount = new BN(9000);
  const XCHFMintAmount = toWei(1000000);
  const Shareholder1 = accounts[1];
  const Tokenholder1 = accounts[2];

  beforeEach('Setup new environment', async function() {
    /**
     * Deploy instances of all involved contracts
     */
    XCHFInstance = await XCHF.new('Crypto Franc', new BN(0));
    EQUITYInstance = await EQUITY.new(XCHFInstance.address);
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
      XCHFInstance.mint(Shareholder1, XCHFMintAmount)
    ]);

    // Shareholder1 swaps some shares for draggable shares and distributes them
    await EQUITYInstance.approve(Draggable.address, 8000, {
      from: Shareholder1
    });

    await Promise.all([
      Draggable.wrap(Shareholder1, 5000, { from: Shareholder1 }),
      Draggable.wrap(Tokenholder1, 1000, { from: Shareholder1 })
    ]);
  });

  it('Burn works', async () => {
    // Before burning
    const Tokenholder1BalanceBefore = await Draggable.balanceOf(Tokenholder1);
    const TotalDraggableBefore = await Draggable.totalSupply();
    const TotalShareTokensBefore = await EQUITYInstance.totalSupply();

    // Burn
    await Draggable.burn(Tokenholder1BalanceBefore, { from: Tokenholder1 });

    // After burning
    const Tokenholder1BalanceAfter = await Draggable.balanceOf(Tokenholder1);
    const TotalDraggableAfter = await Draggable.totalSupply();
    const TotalShareTokensAfter = await EQUITYInstance.totalSupply();

    assert(
      Tokenholder1BalanceAfter.isZero(),
      'User still has tokens after burn'
    );
    assert(
      TotalDraggableBefore.sub(Tokenholder1BalanceBefore).eq(
        TotalDraggableAfter
      ),
      'TotalSupply() not reduced during burn'
    );
    assert(
      TotalShareTokensBefore.sub(Tokenholder1BalanceBefore).eq(
        TotalShareTokensAfter
      ),
      'TotalSupply() not reduced during burn'
    );
  });

  it("NEG - Can't burn more than you have", async () => {
    // Before burning
    const Tokenholder1BalanceBefore = await Draggable.balanceOf(Tokenholder1);
    const TotalDraggableBefore = await Draggable.totalSupply();
    const TotalShareTokensBefore = await EQUITYInstance.totalSupply();

    // Burn
    await shouldRevert(
      Draggable.burn(Tokenholder1BalanceBefore.add(new BN(1)), {
        from: Tokenholder1
      }),
      'Balance insufficient'
    );

    // After burning
    const Tokenholder1BalanceAfter = await Draggable.balanceOf(Tokenholder1);
    const TotalDraggableAfter = await Draggable.totalSupply();
    const TotalShareTokensAfter = await EQUITYInstance.totalSupply();

    assert(
      Tokenholder1BalanceAfter.eq(Tokenholder1BalanceBefore),
      'User still has tokens after burn'
    );
    assert(
      TotalDraggableBefore.eq(TotalDraggableAfter),
      'TotalSupply() (tokens) accidentaly reduced during failed burn'
    );
    assert(
      TotalShareTokensBefore.eq(TotalShareTokensAfter),
      'TotalSupply() (tokens) accidentaly reduced during failed burn'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
