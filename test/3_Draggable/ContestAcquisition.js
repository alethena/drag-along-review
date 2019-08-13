const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);


const BN = require('bn.js');
const increaseTime = require('../utilities/helpers').increaseTime;
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Draggable - Contest Acquisition', accounts => {
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
  const pricePerShare = toWei(2);
  
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

    // Shareholder1 gives XCHF allowance to draggable contract...
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });
  });

  it('Contest works if offer is expired', async () => {
    //  Shareholder 1 makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // The quorum is reached
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteYes({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder2 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder3 }), //500 votes
      Draggable.voteYes({ from: Tokenholder4 }) //500 votes
    ]);

    // But the buyer waits too long
    await increaseTime(60 * 60 * 24 * 30 * 3 + 1000);

    const tx = await Draggable.contestAcquisition();
    const offerExists = await Draggable.offerExists();

    checkEvents(offerExists, tx, 'Offer expired');
  });

  it('Contest works if absolute quorum has failed', async () => {
    //  Shareholder 1 makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // The quorum fails
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteNo({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder2 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder3 }), //500 votes
      Draggable.voteNo({ from: Tokenholder4 }) //500 votes
    ]);

    // Offer can be killed
    const tx = await Draggable.contestAcquisition();
    const offerExists = await Draggable.offerExists();
    checkEvents(offerExists, tx, 'Not enough support.');
  });

  it('Contest works if relative quorum has failed', async () => {
    //  Shareholder 1 makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // The absolute quorum fails
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteNo({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder2 }) // 1000 votes
    ]);

    // Can't kill yet
    await shouldRevert(
      Draggable.contestAcquisition(),
      'Acquisition contest unsuccessful'
    );

    // Let time pass
    await increaseTime(60 * 60 * 24 * 30 * 2 + 1000);

    // Offer can now be killed
    const tx = await Draggable.contestAcquisition();
    const offerExists = await Draggable.offerExists();
    checkEvents(offerExists, tx, 'Not enough support.');
  });

  it('Contest works if funding insufficient (balance)', async () => {
    //  Shareholder 1 makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // The absolute quorum is reached
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteYes({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteYes({ from: Tokenholder2 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder3 }), //500 votes
      Draggable.voteNo({ from: Tokenholder4 }) //500 votes
    ]);

    const XCHFBal = await XCHFInstance.balanceOf(Shareholder1);
    await XCHFInstance.transfer(Tokenholder1, XCHFBal, { from: Shareholder1 });

    // Offer can be killed
    const tx = await Draggable.contestAcquisition();
    const offerExists = await Draggable.offerExists();
    checkEvents(offerExists, tx, 'Offer was not sufficiently funded.');
  });

  it('Contest works if funding insufficient (allowance)', async () => {
    //  Shareholder 1 makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // The absolute quorum is reached
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteYes({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteYes({ from: Tokenholder2 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder3 }), //500 votes
      Draggable.voteNo({ from: Tokenholder4 }) //500 votes
    ]);

    await XCHFInstance.approve(Draggable.address, 0, { from: Shareholder1 });

    // Offer can be killed
    const tx = await Draggable.contestAcquisition();
    const offerExists = await Draggable.offerExists();
    checkEvents(offerExists, tx, 'Offer was not sufficiently funded.');
  });

  it("NEG - Can't contest a good offer (before vote ended)", async () => {
    //  Shareholder 1 makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // The absolute quorum fails
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteNo({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder2 }) // 1000 votes
    ]);

    // Killing fails because voting is still in progress
    await shouldRevert(
      Draggable.contestAcquisition(),
      'Acquisition contest unsuccessful'
    );

    // But after voting period it could be killed
    await increaseTime(60 * 60 * 24 * 30 * 2 + 1000);
    await Draggable.contestAcquisition();
  });

  it("NEG - Can't contest a good offer (after vote ended)", async () => {
    //  Shareholder 1 makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // The absolute quorum fails
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteNo({ from: Tokenholder1 }), // 1000 votes
    ]);

    // Killing fails because vote is still open
    await shouldRevert(
        Draggable.contestAcquisition(),
        'Acquisition contest unsuccessful'
      );

    await increaseTime(60 * 60 * 24 * 30 * 2 + 1000);
    
    // Killing fails because the relative quorum was reached
    await shouldRevert(
      Draggable.contestAcquisition(),
      'Acquisition contest unsuccessful'
    );
  });

  it("NEG - Can't contest if there is no offer", async () => {
    await shouldRevert(
      Draggable.contestAcquisition(),
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

function checkEvents(offerExists, tx, expectedMsg) {
  assert(offerExists === false, 'Offer was not killed');
  assert(
    tx.logs[0].event === 'OfferEnded',
    'Wrong event type for acquisition contest'
  );
  assert(tx.logs[0].args.success === false, 'Wrong sucess status in event');
  assert(tx.logs[0].args.message === expectedMsg, 'Wrong message in event');
}

