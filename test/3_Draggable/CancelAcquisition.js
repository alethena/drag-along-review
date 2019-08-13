const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const BN = require('bn.js');
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Draggable - Cancel Acquisition', accounts => {
  let Draggable;
  let EQUITYInstance;
  let XCHFInstance;

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

    // An offer is made
    const pricePerShare = toWei(2);
    const newPricePerShare = toWei(25).div(new BN(10));

    // Shareholder1 gives XCHF allowance to draggable contract...
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });

    // ...and makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    const offerPending = await Draggable.offerExists();
    assert(offerPending === true, 'Offer creation failed');
  });

  it('CancelAcquisition before voting', async () => {
    await Draggable.cancelAcquisition({ from: Shareholder1 });

    // Make sure offer is gone
    const offerPending = await Draggable.offerExists();
    assert(offerPending === false, 'Offer cancellation failed');
  });

  it('CancelAcquisition after positive voting', async () => {
    // People vote and the absolute yes quorum is reached
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }),
      Draggable.voteYes({ from: Tokenholder1 }),
      Draggable.voteYes({ from: Tokenholder2 }),
      Draggable.voteNo({ from: Tokenholder3 }),
      Draggable.voteYes({ from: Tokenholder4 })
    ]);

    // The buyer can still kill the offer even if we have the absolute yes quorum
    await Draggable.cancelAcquisition({ from: Shareholder1 });
    const offerPending = await Draggable.offerExists();
    assert(offerPending === false, 'Offer cancellation failed');
  });

  it('NEG - Only buyer can cancel acquisition', async () => {
    await shouldRevert(
      Draggable.cancelAcquisition({ from: Tokenholder1 }),
      'You are not authorized to cancel this acquisition offer'
    );
  });

  it("NEG - Can't cancel if there is no offer", async () => {
    await Draggable.cancelAcquisition({ from: Shareholder1 });
    // Make sure offer is gone
    const offerPending = await Draggable.offerExists();
    assert(offerPending === false, 'Offer cancellation failed');

    await shouldRevert(
      Draggable.cancelAcquisition({ from: Shareholder1 }),
      'There is no pending offer'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
