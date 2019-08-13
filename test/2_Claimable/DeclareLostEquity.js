const EQUITY = artifacts.require('../contracts/ServiceHunterShares.sol');
const XCHF = artifacts.require('../contracts/Testing/XCHF/CryptoFranc.sol');

const DraggableShare = artifacts.require(
  '../contracts/DraggableServiceHunterShares.sol'
);

const web3utils = require('web3-utils');
const BN = require('bn.js');
const exponent = new BN(18);

const increaseTime = require('../utilities/helpers').increaseTime;
const shouldRevert = require('../utilities/helpers').shouldRevert;

contract('Claimable - Claim Lost - Equity', accounts => {
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
  const nonce = web3utils.sha3('Best nonce ever');
  const package = web3utils.soliditySha3(nonce, Shareholder1, Shareholder2);

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

    // Shareholder1 claims the shares of Shareholder2
    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
      from: Shareholder1
    });
  });

  it("NEG - Can't claim address if claiming is disabled", async () => {
    // Shareholder2 decides to disable claiming their address
    await EQUITYInstance.setClaimable(false, { from: Shareholder2 });

    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
        from: Shareholder1
      }),
      'Claims disabled for this address'
    );
  });

  it("NEG - Can't claim using unsupported collateral type", async () => {
    // Choosing BS collateral address
    const someWeirdCollateralAddress =
      '0x1dD415BE08acBaC7203155743b7e6AA866c9CcEA';
    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    await shouldRevert(
      EQUITYInstance.declareLost(
        someWeirdCollateralAddress,
        Shareholder2,
        nonce,
        {
          from: Shareholder1
        }
      ),
      'Unsupported collateral type'
    );
  });

  it("NEG - Can't claim address with empty holdings", async () => {
    // Choosing BS collateral address
    const someWeirdCollateralAddress =
      '0x1dD415BE08acBaC7203155743b7e6AA866c9CcEA';
    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );
    await EQUITYInstance.transfer(Tokenholder1, Shareholder2Balance, {
      from: Shareholder2
    });
    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
        from: Shareholder1
      }),
      'Claimed address holds no shares'
    );
  });

  it("NEG - Can't claim if currency allowance is insufficient", async () => {
    await increaseTime(60 * 60 * 24 + 1000);
    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
        from: Shareholder1
      }),
      'Currency allowance insufficient'
    );
  });

  it("NEG - Can't claim if currency balance is insufficient", async () => {
    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const XCHFBal = await XCHFInstance.balanceOf(Shareholder1);
    await XCHFInstance.transfer(Tokenholder2, XCHFBal, { from: Shareholder1 });
    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
        from: Shareholder1
      }),
      'Currency balance insufficient'
    );
  });

  it("NEG - Can't claim address if there is an existing claim", async () => {
    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
      from: Shareholder1
    });

    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
      from: Tokenholder2
    });

    await XCHFInstance.transfer(Tokenholder2, collateral, {
      from: Shareholder1
    });
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Tokenholder2
    });

    await increaseTime(60 * 60 * 24 + 1000);
    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
        from: Tokenholder2
      }),
      'Address already claimed'
    );
  });

  it('NEG - Preclaim period violated (too early)', async () => {
    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
      from: Shareholder1
    });
    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
        from: Shareholder1
      }),
      'Preclaim period violated'
    );
  });

  it('NEG - Preclaim period violated (too late)', async () => {
    await EQUITYInstance.prepareClaim(web3utils.toHex(package), {
      from: Shareholder1
    });
    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 48 + 1000);

    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce, {
        from: Shareholder1
      }),
      'Preclaim period violated'
    );
  });

  it("NEG - Can't claim with incorrect nonce", async () => {
    const Shareholder2Balance = await EQUITYInstance.balanceOf(Shareholder2);
    const collateralRate = await EQUITYInstance.getCollateralRate(
      XCHFInstance.address
    );

    const collateral = Shareholder2Balance.mul(collateralRate);
    await XCHFInstance.approve(EQUITYInstance.address, collateral, {
      from: Shareholder1
    });

    await increaseTime(60 * 60 * 24 + 1000);
    const nonce2 = web3utils.sha3('A really bad nonce :-(');

    await shouldRevert(
      EQUITYInstance.declareLost(XCHFInstance.address, Shareholder2, nonce2, {
        from: Shareholder1
      }),
      'Package could not be validated'
    );
  });
});

function toWei(amount) {
  const exponent = new BN(18);
  const base = new BN(10);
  const amountBN = new BN(amount);
  return amountBN.mul(base.pow(exponent));
}
