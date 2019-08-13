const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const Acquisition = artifacts.require('../contracts/Acquisition.sol');

const BN = require('bn.js');
const increaseTime = require('../utilities/helpers').increaseTime;

contract('Draggable - Standard Scenarios', accounts => {
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
  });

  /**
   * This test simulates the standard drag along process without any special challenges.
   * In this case, the absolute quroum is reached early.
   */

  it('Early completion with absolute quorum', async () => {
    const pricePerShare = toWei(2);

    // Shareholder1 gives XCHF allowance to draggable contract...
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });

    // ...and makes acquisition offer
    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    // People vote and the absolute yes quorum is reached
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }),
      Draggable.voteYes({ from: Tokenholder1 }),
      Draggable.voteYes({ from: Tokenholder2 }),
      Draggable.voteNo({ from: Tokenholder3 }),
      Draggable.voteYes({ from: Tokenholder4 })
    ]);

    // Check that acquisition has not been completed yet
    let acquired = await Draggable.wasAcquired();
    assert(acquired === false, 'Wrong acquisition status');

    const draggableBalanceBefore = await EQUITYInstance.balanceOf(
      Draggable.address
    );
    const buyerShareBalanceBefore = await EQUITYInstance.balanceOf(
      Shareholder1
    );

    // Buyer completes acquisition offer
    await Draggable.completeAcquisition({ from: Shareholder1 });

    // Now check that acquisition is completed
    acquired = await Draggable.wasAcquired();
    assert(acquired === true, 'Wrong acquisition status');

    // Check that buyer now has all shares previously held by draggable contract
    const draggableBalanceAfter = await EQUITYInstance.balanceOf(
      Draggable.address
    );
    const buyerShareBalanceAfter = await EQUITYInstance.balanceOf(Shareholder1);

    assert(
      draggableBalanceBefore
        .add(buyerShareBalanceBefore)
        .eq(buyerShareBalanceAfter),
      'Acquisition completion balnce error'
    );
    assert(
      draggableBalanceAfter.isZero(),
      'Acquisition completion balnce error'
    );

    // Cash retrieval checked later
  });

  /**
   * This test simulates the standard drag along process without any special challenges.
   * In this case, the absolute quroum is not reached early but at the end the relative quroum is reached.
   */

  it('Standard offer process with relative quorum', async () => {
    const pricePerShare = new toWei(2);

    // Shareholder1 makes acquisition offer
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });

    await Draggable.initiateAcquisition(pricePerShare, { from: Shareholder1 });

    const offerAddress = await Draggable.offer();
    let offer = await Acquisition.at(offerAddress);

    let shareholder1vote = await offer.hasVotedYes(Shareholder1);
    let tokenholder2vote = await offer.hasVotedNo(Tokenholder2);

    assert(shareholder1vote == false, 'Vote recorded incorrectly');
    assert(tokenholder2vote == false, 'Vote recorded incorrectly');

    // Voting begins
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }),
      Draggable.voteNo({ from: Tokenholder2 }),
      Draggable.voteNo({ from: Tokenholder3 })
    ]);

    const Shareholder1Balance = await Draggable.balanceOf(Shareholder1);
    const Tokenholder2Balance = await Draggable.balanceOf(Tokenholder2);
    const Tokenholder3Balance = await Draggable.balanceOf(Tokenholder3);

    const yesVotes = await offer.yesVotes();
    const noVotes = await offer.noVotes();

    assert(yesVotes.eq(Shareholder1Balance), 'Wrong number of yes - votes');

    assert(
      noVotes.eq(Tokenholder2Balance.add(Tokenholder3Balance)),
      'Wrong number of no - votes'
    );

    shareholder1vote = await offer.hasVotedYes(Shareholder1);
    tokenholder2vote = await offer.hasVotedNo(Tokenholder2);

    assert(shareholder1vote == true, 'Vote recorded incorrectly');
    assert(tokenholder2vote == true, 'Vote recorded incorrectly');

    const acceptedBefore = await Draggable.wasAcquired();
    assert(acceptedBefore == false, 'Offer wrongly recorded as accepted');

    // Some time needs to pass
    await increaseTime(60 * 60 * 24 * 30 * 2 + 1000);

    // Buyer completes offer
    await Draggable.completeAcquisition({ from: Shareholder1 });

    // Check that offer is now accepted
    const acceptedAfter = await Draggable.wasAcquired();
    assert(acceptedAfter == true);

    // Tokenholders collect their cash :-)
    const Tokenholder1BalanceBefore = await Draggable.balanceOf(Tokenholder1);
    const Tokenholder1XCHFBalanceBefore = await XCHFInstance.balanceOf(
      Tokenholder1
    );

    await Draggable.unwrap(Tokenholder1BalanceBefore, {
      from: Tokenholder1
    });

    const Tokenholder1BalanceAfter = await Draggable.balanceOf(Tokenholder1);
    const Tokenholder1XCHFBalanceAfter = await XCHFInstance.balanceOf(
      Tokenholder1
    );

    assert(Tokenholder1BalanceAfter.isZero(), 'Tokenholder still has tokens');

    assert(
      Tokenholder1XCHFBalanceAfter.eq(
        Tokenholder1XCHFBalanceBefore.add(
          Tokenholder1BalanceBefore.mul(pricePerShare)
        )
      ),
      'Tokenholder still has tokens'
    );

    // Everyone else collects XCHF too
    const [balance2, balance3, balance4] = await Promise.all([
      Draggable.balanceOf(Tokenholder2),
      Draggable.balanceOf(Tokenholder3),
      Draggable.balanceOf(Tokenholder4)
    ]);

    await Promise.all([
      Draggable.unwrap(balance2, { from: Tokenholder2 }),
      Draggable.unwrap(balance3, { from: Tokenholder3 }),
      Draggable.unwrap(balance4, { from: Tokenholder4 })
    ]);
  });

  /**
   * This test simulates the standard drag along process without any special challenges.
   * In this case, a counteroffer is made and accepted.
   */
  it('Standard offer process with counteroffer', async () => {
    const pricePerShare = toWei(2);
    const newPricePerShare = toWei(25).div(new BN(10));

    // Shareholder1 makes acquisition offer
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });

    await Draggable.initiateAcquisition(pricePerShare, {
      from: Shareholder1
    });

    let offerAddress = await Draggable.offer();
    let offer = await Acquisition.at(offerAddress);
    let buyer = await offer.buyer();
    let price = await offer.price();
    assert(Shareholder1 == buyer, 'Wrong buyer info');
    assert(pricePerShare.eq(price), 'Wrong price info');

    let noVotes = await offer.noVotes();
    let yesVotes = await offer.yesVotes();
    assert(noVotes.isZero(), 'Wrong number of no - votes');
    assert(yesVotes.isZero(), 'Wrong number of yes - votes');
    const offerAccepted = await Draggable.wasAcquired();
    assert(offerAccepted == false);

    const SH1XCHFBalance = await XCHFInstance.balanceOf(Shareholder1);
    await XCHFInstance.transfer(Tokenholder1, SH1XCHFBalance, {
      from: Shareholder1
    });

    await XCHFInstance.approve(Draggable.address, SH1XCHFBalance, {
      from: Tokenholder1
    });

    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }),
      Draggable.voteYes({ from: Tokenholder1 }),
      Draggable.voteYes({ from: Tokenholder2 }),
      Draggable.voteYes({ from: Tokenholder3 }),
      Draggable.voteYes({ from: Tokenholder4 })
    ]);

    await Draggable.initiateAcquisition(newPricePerShare, {
      from: Tokenholder1
    });

    offerAddress = await Draggable.offer();
    offer = await Acquisition.at(offerAddress);
    buyer = await offer.buyer();
    price = await offer.price();

    assert(Tokenholder1 == buyer, 'Wrong buyer info');
    assert(newPricePerShare.eq(price), 'Wrong price info');

    noVotes = await offer.noVotes();
    yesVotes = await offer.yesVotes();

    assert(noVotes.isZero(), 'Wrong number of no - votes');
    assert(yesVotes.isZero(), 'Wrong number of yes - votes');
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
