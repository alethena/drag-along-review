const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const BN = require('bn.js');
const increaseTime = require('../utilities/helpers').increaseTime;
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Draggable - Complete Acquisition', accounts => {
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

  it('NEG - Only buyer can complete offer', async () => {
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

    /**
     * At this point we have
     * Total possible votes: 8000
     * Total votes: 8000
     * Yes votes: 6500 (~81% abs)
     * This is an absolute yes
     */

    // Tokenholder1 can't complete acquisition
    await shouldRevert(
      Draggable.completeAcquisition({ from: Tokenholder1 }),
      'You are not authorized to complete this acquisition offer'
    );

    // But Shareholder1 can
    await Draggable.completeAcquisition({ from: Shareholder1 });
  });

  it("NEG - Can't complete if there is no offer", async () => {
    // As there is no offer ,this should revert
    await shouldRevert(
      Draggable.completeAcquisition({ from: Shareholder1 }),
      'There is no pending offer'
    );
  });

  it("NEG - Can't complete offer early", async () => {
    const pricePerShare = toWei(2);
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    const offerPending = await Draggable.offerExists();
    assert(offerPending === true, 'Offer creation failed');

    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteNo({ from: Tokenholder2 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder3 }), // 500 votes
      Draggable.voteYes({ from: Tokenholder4 }) // 500 votes
    ]);

    /**
     * At this point we have
     * Total possible votes: 8000
     * Total votes: 7000
     * Yes votes: 5500 (~78% rel, ~69% abs)
     * No Votes: 1500
     * This is a relative yes, but not absolute
     */

    // Early completion fails
    await shouldRevert(
      Draggable.completeAcquisition({ from: Shareholder1 }),
      'Insufficient number of yes votes'
    );

    // Some time passes
    await increaseTime(60 * 60 * 24 * 30 * 2 + 1000);
    await Draggable.completeAcquisition({ from: Shareholder1 });
  });

  it("NEG - Can't complete if money is missing (balance)", async () => {
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

    /**
     * At this point we have
     * Total possible votes: 8000
     * Total votes: 8000
     * Yes votes: 6500 (~81% abs)
     * This is an absolute yes
     */
    const XCHFBal = await XCHFInstance.balanceOf(Shareholder1);
    await XCHFInstance.transfer(Tokenholder1, XCHFBal, { from: Shareholder1 });

    await shouldRevert(
      Draggable.completeAcquisition({ from: Shareholder1 }),
      'Offer insufficiently funded'
    );
  });

  it("NEG - Can't complete if money is missing (allowance)", async () => {
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

    /**
     * At this point we have
     * Total possible votes: 8000
     * Total votes: 8000
     * Yes votes: 6500 (~81% abs)
     * This is an absolute yes
     */
    await XCHFInstance.approve(Draggable.address, 0, { from: Shareholder1 });

    await shouldRevert(
      Draggable.completeAcquisition({ from: Shareholder1 }),
      'Offer insufficiently funded'
    );
  });

  it("NEG - Can't complete if relative quorum is not reached", async () => {
    const pricePerShare = toWei(2);
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    const offerPending = await Draggable.offerExists();
    assert(offerPending === true, 'Offer creation failed');

    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }), // 5000 votes
      Draggable.voteNo({ from: Tokenholder1 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder2 }), // 1000 votes
      Draggable.voteNo({ from: Tokenholder3 }), //500 votes
      Draggable.voteNo({ from: Tokenholder4 }) //500 votes
    ]);

    /**
     * At this point we have
     * Total possible votes: 8000
     * Total votes: 8000
     * Yes votes: 5000 (~63% abs)
     * This is an absolute no
     */

    await shouldRevert(
      Draggable.completeAcquisition({ from: Shareholder1 }),
      'Insufficient number of yes votes'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}

// /**
//  * This test simulates the standard drag along process but completion fails because money is missing.
//  */

// it('Drag along completion fails due to missing money', async () => {
//   const pricePerShare = new BN(2);

//   // Shareholder1 makes acquisition offer
//   await XCHFInstance.approve(
//     Draggable.address,
//     XCHFMintAmount.mul(power),
//     { from: Shareholder1 }
//   );
//   await Draggable.initiateAcquisition(pricePerShare.mul(power), {
//     from: Shareholder1
//   });

//   // Voting begins

//   await Promise.all([
//     Draggable.voteYes({ from: Shareholder1 }),
//     Draggable.voteYes({ from: Tokenholder1 }),
//     Draggable.voteYes({ from: Tokenholder2 }),
//     Draggable.voteNo({ from: Tokenholder3 }),
//     Draggable.voteYes({ from: Tokenholder4 })
//   ]);

//   const buyerBalance = await XCHFInstance.balanceOf(Shareholder1);

//   await XCHFInstance.transfer(Shareholder2, buyerBalance, {
//     from: Shareholder1
//   });

//   await shouldRevert(
//     Draggable.completeAcquisition({ from: Shareholder1 }),
//     'revert'
//   );

//   await XCHFInstance.transfer(Shareholder1, buyerBalance, {
//     from: Shareholder2
//   });

//   await Draggable.completeAcquisition({ from: Shareholder1 });
// });
