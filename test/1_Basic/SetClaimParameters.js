const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const BN = require('bn.js');
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Basic - Set claim parameters', accounts => {
  let Draggable;
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

  it('Custom claim collateral set correctly', async () => {
    // Initially not an option
    const isAnOptionBefore = await Draggable.getCollateralRate(
      XCHFInstance.address
    );

    const isAnOptionBeforeEQUITY = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    assert(
      isAnOptionBefore.isZero(),
      'Custom collateral wrongly set initially'
    );

    assert(
      isAnOptionBeforeEQUITY.isZero(),
      'Custom collateral wrongly set initially'
    );

    await EQUITYInstance.setCustomClaimCollateral(
      XCHFInstance.address,
      toWei(1)
    );

    // Now it is set
    const isAnOptionAfter = await Draggable.getCollateralRate(
      XCHFInstance.address
    );

    const isAnOptionAfterEQUITY = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    assert(
      isAnOptionAfter.eq(toWei(1)),
      'Custom collateral wrongly set initially'
    );

    assert(
      isAnOptionAfterEQUITY.eq(toWei(1)),
      'Custom collateral wrongly set initially'
    );
  });

  it('Claim period set correctly', async () => {
    const newPeriodInDays = new BN(200);
    const newPeriodInSeconds = newPeriodInDays.mul(new BN(86400));

    await EQUITYInstance.setClaimPeriod(newPeriodInDays);

    const newClaimPeriodEQUITY = await EQUITYInstance.claimPeriod();

    assert(
      newClaimPeriodEQUITY.eq(newPeriodInSeconds),
      'EQUITY claim period set false'
    );
  });

  it('NEG - Collateral rate cannot be negative', async () => {
    await shouldRevert(
      EQUITYInstance.setCustomClaimCollateral(XCHFInstance.address, new BN(0)),
      "Collateral rate can't be zero"
    );
  });

  it('NEG - Only owner can set custom collateral', async () => {
    await shouldRevert(
      EQUITYInstance.setCustomClaimCollateral(XCHFInstance.address, toWei(1), {
        from: Tokenholder1
      }),
      'You are not the owner of this contract'
    );
  });

  it('NEG - Only owner can set claim period', async () => {
    await shouldRevert(
      EQUITYInstance.setClaimPeriod(200, {
        from: Tokenholder1
      }),
      'You are not the owner of this contract'
    );
  });

  it("NEG - Can't break lower limit on claim period", async () => {
    await shouldRevert(
      EQUITYInstance.setClaimPeriod(50),
      'Claim period must be at least 90 days'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
