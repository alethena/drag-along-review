const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const BN = require('bn.js');
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Draggable - Wrap', accounts => {
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
  const Tokenholder5 = accounts[7];

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

  it("NEG - Can't wrap if contract is inactive", async () => {
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
    await EQUITYInstance.approve(Draggable.address, 1000, {
      from: Shareholder2
    });

    await shouldRevert(
      Draggable.wrap(Shareholder2, 1000, { from: Shareholder2 }),
      'There is a pending offer '
    );
  });

  it("NEG - Can't wrap if share balance insufficient", async () => {
    await EQUITYInstance.approve(Draggable.address, 2000, {
      from: Shareholder1
    });
    await shouldRevert(
      Draggable.wrap(Tokenholder5, 2000, { from: Shareholder1 }),
      'Share balance not sufficient'
    );
  });

  it("NEG - Can't wrap if share allowance insufficient", async () => {
    await EQUITYInstance.approve(Draggable.address, 500, {
      from: Shareholder1
    });
    await shouldRevert(
      Draggable.wrap(Tokenholder5, 1000, { from: Shareholder1 }),
      'Share allowance not sufficient'
    );
  });

  it("NEG - Can't wrap if there is a pending offer", async () => {
    const pricePerShare = new toWei(2);
    await EQUITYInstance.transfer(Tokenholder1, 500, { from: Shareholder1 });

    // Shareholder1 makes acquisition offer
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });

    await Draggable.initiateAcquisition(pricePerShare, { from: Shareholder1 });

    // Try to wrap
    await EQUITYInstance.approve(Draggable.address, 500, {
      from: Shareholder1
    });

    await shouldRevert(
      Draggable.wrap(Tokenholder5, 500, { from: Shareholder1 }),
      'There is a pending offer'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
