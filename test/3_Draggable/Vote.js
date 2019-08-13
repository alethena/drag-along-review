const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const Acquisition = artifacts.require('../contracts/Acquisition.sol');

const BN = require('bn.js');

contract('Draggable - Vote', accounts => {
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
  });

  it('Vote Yes', async () => {
    offerAddress = await Draggable.offer();
    offer = await Acquisition.at(offerAddress);
    const yesVotesBefore = await offer.yesVotes();
    const noVotesBefore = await offer.noVotes();
    const hasVotedYesBefore = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoBefore = await offer.hasVotedNo(Shareholder1);
    const balance = await Draggable.balanceOf(Shareholder1);

    assert(hasVotedYesBefore === false, 'Already voted - test is bad');
    assert(hasVotedNoBefore === false, 'Already voted - test is bad');

    await Draggable.voteYes({ from: Shareholder1 });

    const yesVotesAfter = await offer.yesVotes();
    const noVotesAfter = await offer.noVotes();
    const hasVotedYesAfter = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoAfter = await offer.hasVotedNo(Shareholder1);

    assert(hasVotedYesAfter === true, 'Yes vote no recorded');
    assert(hasVotedNoAfter === false, 'No vote falsly recorded');

    assert(
      yesVotesBefore.add(balance).eq(yesVotesAfter),
      'Yes votes counted incorrectly'
    );
    assert(noVotesBefore.eq(noVotesAfter), 'No votes counted incorrectly');
  });

  it('Vote No', async () => {
    offerAddress = await Draggable.offer();
    offer = await Acquisition.at(offerAddress);
    const yesVotesBefore = await offer.yesVotes();
    const noVotesBefore = await offer.noVotes();
    const hasVotedYesBefore = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoBefore = await offer.hasVotedNo(Shareholder1);
    const balance = await Draggable.balanceOf(Shareholder1);

    assert(hasVotedYesBefore === false, 'Already voted - test is bad');
    assert(hasVotedNoBefore === false, 'Already voted - test is bad');

    await Draggable.voteNo({ from: Shareholder1 });

    const yesVotesAfter = await offer.yesVotes();
    const noVotesAfter = await offer.noVotes();
    const hasVotedYesAfter = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoAfter = await offer.hasVotedNo(Shareholder1);

    assert(hasVotedYesAfter === false, 'Yes vote falsly recorded');
    assert(hasVotedNoAfter === true, 'No vote not recorded');

    assert(yesVotesBefore.eq(yesVotesAfter), 'Yes votes counted incorrectly');
    assert(
      noVotesBefore.add(balance).eq(noVotesAfter),
      'No votes counted incorrectly'
    );
  });

  it('Changing vote from yes to no', async () => {
    offerAddress = await Draggable.offer();
    offer = await Acquisition.at(offerAddress);

    await Draggable.voteYes({ from: Shareholder1 });
    const yesVotesBefore = await offer.yesVotes();
    const noVotesBefore = await offer.noVotes();
    const hasVotedYesBefore = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoBefore = await offer.hasVotedNo(Shareholder1);
    const balance = await Draggable.balanceOf(Shareholder1);

    assert(hasVotedYesBefore === true, 'Yes not recorded');
    assert(hasVotedNoBefore === false, 'False no vote');

    await Draggable.voteNo({ from: Shareholder1 });

    const yesVotesAfter = await offer.yesVotes();
    const noVotesAfter = await offer.noVotes();
    const hasVotedYesAfter = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoAfter = await offer.hasVotedNo(Shareholder1);

    assert(hasVotedYesAfter === false, 'Yes vote falsly recorded');
    assert(hasVotedNoAfter === true, 'No vote not recorded');

    assert(yesVotesBefore.sub(balance).eq(yesVotesAfter), 'Yes votes counted incorrectly');
    assert(noVotesBefore.add(balance).eq(noVotesAfter),
      'No votes counted incorrectly'
    );
  });

  it('Changing vote from no to yes', async () => {
    offerAddress = await Draggable.offer();
    offer = await Acquisition.at(offerAddress);

    await Draggable.voteNo({ from: Shareholder1 });
    const yesVotesBefore = await offer.yesVotes();
    const noVotesBefore = await offer.noVotes();
    const hasVotedYesBefore = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoBefore = await offer.hasVotedNo(Shareholder1);
    const balance = await Draggable.balanceOf(Shareholder1);

    assert(hasVotedYesBefore === false, 'False yes vote');
    assert(hasVotedNoBefore === true, 'no vote not recorded');

    await Draggable.voteYes({ from: Shareholder1 });

    const yesVotesAfter = await offer.yesVotes();
    const noVotesAfter = await offer.noVotes();
    const hasVotedYesAfter = await offer.hasVotedYes(Shareholder1);
    const hasVotedNoAfter = await offer.hasVotedNo(Shareholder1);

    assert(hasVotedYesAfter === true, 'Yes vote not recorded');
    assert(hasVotedNoAfter === false, 'No vote falsliy recorded');

    assert(yesVotesBefore.add(balance).eq(yesVotesAfter), 'Yes votes counted incorrectly');
    assert(noVotesBefore.sub(balance).eq(noVotesAfter),
      'No votes counted incorrectly'
    );
  });

  it('Votes change when shares are transferred', async () => {
    offerAddress = await Draggable.offer();
    offer = await Acquisition.at(offerAddress);

    await Draggable.voteYes({ from: Shareholder1 });
    await Draggable.voteNo({ from: Shareholder2 });

    const yesVotesBefore = await offer.yesVotes();
    const noVotesBefore = await offer.noVotes();

    const transferAmount = new BN(500);

    await Draggable.transfer(Shareholder2, transferAmount, {from: Shareholder1});

    const yesVotesAfter = await offer.yesVotes();
    const noVotesAfter = await offer.noVotes();

    assert(
      yesVotesBefore.sub(transferAmount).eq(yesVotesAfter),
      'Yes votes counted incorrectly'
    );
    assert(noVotesBefore.add(transferAmount).eq(noVotesAfter), 'No votes counted incorrectly');
  });

});


function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
