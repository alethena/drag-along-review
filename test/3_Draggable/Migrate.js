const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const UpdatedContract = artifacts.require(
  '../../contracts/Testing/Migration/UpdatedContract.sol'
);

const BN = require('bn.js');
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Draggable - Migrate', accounts => {
  let Draggable;
  let EQUITYInstance;
  let XCHFInstance;
  // let UpdatedContractInstance;

  const EQUITYMintAmount = new BN(10000);
  const EQUITYShareholder1MintAmount = new BN(9000);
  const EQUITYShareholder2MintAmount = new BN(1000);

  const XCHFMintAmount = toWei(1000000);

  const Shareholder1 = accounts[1];
  const Shareholder2 = accounts[2];
  const Tokenholder1 = accounts[3];
  const Tokenholder2 = accounts[4];
  const Tokenholder3 = accounts[5];
  const Tokenholder4 = accounts[6];

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

  it('Standard migration scenario', async () => {
    UpdatedInstance = await UpdatedContract.new();

    // Mint tokens
    await UpdatedInstance.mint(UpdatedInstance.address, new BN(100000));

    await Promise.all([
      Draggable.transfer(UpdatedInstance.address, 5000, { from: Shareholder1 }),
      Draggable.transfer(UpdatedInstance.address, 1000, { from: Tokenholder1 }),
      Draggable.transfer(UpdatedInstance.address, 1000, { from: Tokenholder2 }),
      Draggable.transfer(UpdatedInstance.address, 500, { from: Tokenholder3 }),
      Draggable.transfer(UpdatedInstance.address, 500, { from: Tokenholder4 })
    ]);

    oldEquityBalBefore = await EQUITYInstance.balanceOf(Draggable.address);
    oldTotalSupply = await Draggable.totalSupply();
    newConOldBal = await Draggable.balanceOf(UpdatedInstance.address);

    await UpdatedInstance.setApprovals(Draggable.address, new BN(100000));
    await UpdatedInstance.migrate(Draggable.address);

    oldEquityBalAfter = await EQUITYInstance.balanceOf(Draggable.address);
    newEquityBalAfter = await EQUITYInstance.balanceOf(UpdatedInstance.address);
    oldUpdatedBalAfter = await UpdatedInstance.balanceOf(Draggable.address);

    assert(oldEquityBalAfter.isZero(), "Equity remains on the old contract");
    assert(newEquityBalAfter.eq(oldEquityBalBefore), "Equity not transferred to new contract");
    assert(oldTotalSupply.sub(newConOldBal).eq(oldUpdatedBalAfter), "New token not transferred to new contract");
  });

  it("NEG - Can't migrate if contract is inactive", async () => {
    // Shareholder1 gives XCHF allowance to draggable contract...
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });
    const pricePerShare = toWei(2);
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    const offerPending = await Draggable.offerExists();
    assert(offerPending === true, 'Offer creation failed');

    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteYes({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder2 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder3 }), //500 votes
      Draggable.voteYes({ from: Tokenholder4 }) //500 votes
    ]);

    await Draggable.completeAcquisition({ from: Shareholder1 });
    await UpdatedInstance.setApprovals(Draggable.address, new BN(100000));
    await shouldRevert(UpdatedInstance.migrate(Draggable.address), "Contract is not active");
  });

  it("NEG - Can't migrate if quorum not reached", async () => {
    UpdatedInstance = await UpdatedContract.new();

    // Mint tokens
    await UpdatedInstance.mint(UpdatedInstance.address, new BN(100000));

    await Promise.all([
      Draggable.transfer(UpdatedInstance.address, 1000, { from: Tokenholder1 }),
      Draggable.transfer(UpdatedInstance.address, 1000, { from: Tokenholder2 }),
      Draggable.transfer(UpdatedInstance.address, 500, { from: Tokenholder3 }),
      Draggable.transfer(UpdatedInstance.address, 500, { from: Tokenholder4 })
    ]);

    await UpdatedInstance.setApprovals(Draggable.address, new BN(100000));
    await shouldRevert(
      UpdatedInstance.migrate(Draggable.address),
      'Quorum not reached'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
