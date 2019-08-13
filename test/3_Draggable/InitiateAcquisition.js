const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');
const Acquisition = artifacts.require('../../contracts/Acquisition.sol');
const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const BN = require('bn.js');
const exponent = new BN(18);
const base = new BN(10, 10);
const power = base.pow(exponent);
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Draggable - Initiate Acquisition', accounts => {
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

  it("NEG - Can't initiate if accepted offer exists", async () => {
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

    // People vote and the absolute yes quorum is reached
    await Promise.all([
      Draggable.voteYes({ from: Shareholder1 }),
      Draggable.voteYes({ from: Tokenholder1 }),
      Draggable.voteYes({ from: Tokenholder2 }),
      Draggable.voteNo({ from: Tokenholder3 }),
      Draggable.voteYes({ from: Tokenholder4 })
    ]);

    // Buyer completes acquisition offer
    await Draggable.completeAcquisition({ from: Shareholder1 });

    const SH1XCHFBalance = await XCHFInstance.balanceOf(Shareholder1);
    await XCHFInstance.transfer(Tokenholder1, SH1XCHFBalance, {
      from: Shareholder1
    });

    await XCHFInstance.approve(Draggable.address, SH1XCHFBalance, {
      from: Tokenholder1
    });

    await shouldRevert(
      Draggable.initiateAcquisition(newPricePerShare, {
        from: Tokenholder1
      }),
      'An accepted offer exists'
    );
  });

  it("NEG - Can't initiate if contract does not represent enough equity", async () => {
    // Mint some more share to tip the equity balance
    await EQUITYInstance.setTotalShares(EQUITYMintAmount.add(new BN(30000)));
    await EQUITYInstance.mint(Shareholder2, new BN(30000));

    const pricePerShare = toWei(2);

    // Shareholder1 gives XCHF allowance to draggable contract...
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });

    // ...and makes acquisition offer
    await shouldRevert(
      Draggable.initiateAcquisition(pricePerShare, {
        from: Shareholder1
      }),
      'This contract does not represent enough equity'
    );
  });

  it("NEG - Can't initiate if you don't have >= 5% of tokens", async () => {
    const pricePerShare = toWei(2);

    await EQUITYInstance.approve(Draggable.address, 100, {
      from: Shareholder1
    });

    await Draggable.wrap(Tokenholder5, 100, {
      from: Shareholder1
    });

    await XCHFInstance.mint(Tokenholder5, XCHFMintAmount);

    await XCHFInstance.approve(Draggable.address, XCHFMintAmount.mul(power), {
      from: Tokenholder5
    });

    await shouldRevert(
      Draggable.initiateAcquisition(pricePerShare, { from: Tokenholder5 }),
      'You need to hold at least 5% of the firm to make an offer'
    );
  });

  it("NEG - Can't initiate if insufficiently funded", async () => {
    const pricePerShare = toWei(2);

    // Shareholder1 giives insufficient XCHF allowance to draggable contract...
    await XCHFInstance.approve(Draggable.address, toWei(5000), {
      from: Shareholder1
    });

    // ...and makes acquisition offer
    await shouldRevert(
      Draggable.initiateAcquisition(pricePerShare, {
        from: Shareholder1
      }),
      'Insufficient funding'
    );

    // Shareholder1 gies XCHF allowance to draggable contract...
    await XCHFInstance.approve(Draggable.address, XCHFMintAmount, {
      from: Shareholder1
    });

    // ...but transfers his XCHF away...
    const XCHBal = await XCHFInstance.balanceOf(Shareholder1);
    await XCHFInstance.transfer(Tokenholder1, XCHBal.sub(toWei(5000)), {
      from: Shareholder1
    });

    await shouldRevert(
      Draggable.initiateAcquisition(pricePerShare, {
        from: Shareholder1
      }),
      'Insufficient funding'
    );
  });

  it("NEG - Can't replace an offer if it is not at least 5% better", async () => {
    const pricePerShare = toWei(2);
    const newPricePerShare = toWei(205).div(new BN(100));

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

    await shouldRevert(
      Draggable.initiateAcquisition(newPricePerShare, {
        from: Tokenholder1
      }),
      'New offers must be at least 5% higher than the pending offer'
    );

    offerAddress = await Draggable.offer();
    offer = await Acquisition.at(offerAddress);
    buyer = await offer.buyer();
    price = await offer.price();
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}

// it('Testing 30% condition for making offer', async () => {
//   await EQUITYInstance.setTotalShares(30000);
//   await EQUITYInstance.mint(Tokenholder1, 20000);

//   const pricePerShare = new BN(2);
//   const SH1XCHFBalance = await XCHFInstance.balanceOf(Shareholder1);

//   await XCHFInstance.approve(
//     Draggable.address,
//     XCHFMintAmount.mul(power),
//     { from: Tokenholder5 }
//   );

//   await shouldRevert(
//     Draggable.initiateAcquisition(pricePerShare.mul(power), {
//       from: Shareholder1
//     }),
//     'This contract does not represent enough equity'
//   );
// });
