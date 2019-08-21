 /**
 * Copyright (c) 2019 Equility AG (alethena.com)
 *
 * MIT License with Automated License Fee Payments
 *
 * Permission is hereby granted to any person obtaining a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * - The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * - All automated license fee payments integrated into this and related Software are preserved.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
pragma solidity 0.5.10;

import "./ERC20Claimable.sol";
import "./ERC20Draggable.sol";

/**
 * @title Draggable ServiceHunter AG Shares
 * @author Benjamin Rickenbacher, benjamin@alethena.com
 * @author Luzius Meisser, luzius@meissereconomics.com
 *
 * This is an ERC-20 token representing shares of ServiceHunter AG that are bound to
 * a shareholder agreement that can be found at the URL defined in the constant 'terms'.
 * The shareholder agreement is partially enforced through this smart contract. The agreement
 * is designed to facilitate a complete acquisition of the firm even if a minority of shareholders
 * disagree with the acquisition, to protect the interest of the minority shareholders by requiring
 * the acquirer to offer the same conditions to everyone when acquiring the company, and to
 * facilitate an update of the shareholder agreement even if a minority of the shareholders that
 * are bound to this agreement disagree. The name "draggable" stems from the convention of calling
 * the right to drag a minority along with a sale of the company "drag-along" rights. The name is
 * chosen to ensure that token-holders are aware that they are bound to such an agreement.
 *
 * The percentage of token holders that must agree with an update of the terms is defined by the
 * constant UPDATE_QUORUM. The precentage of yes-votes that is needed to successfully complete an
 * acquisition is defined in the constant ACQUISITION_QUORUM. Note that the update quorum is based
 * on the total number of tokens in circulation. In contrast, the acquisition quorum is based on the
 * number of votes cast during the voting period, not taking into account those who did not bother
 * to vote.
 */


contract DraggableServiceHunterShares is ERC20Claimable, ERC20Draggable {

    string public constant symbol = "DSHS";
    string public constant name = "Draggable ServiceHunter AG Shares";
    string public constant terms = "quitt.ch/ir";

    uint8 public constant decimals = 0;              // legally, shares are not divisible
    uint256 public constant UPDATE_QUORUM = 7500;    // 7500 basis points = 75%
    uint256 public constant ACQUISITION_QUORUM = 7500; // 7500 basis points = 75%
    uint256 public constant OFFER_FEE = 5000 * 10 ** 18; // 5000 XCHF

    /**
     * In the constructor we specify the currency used. In our case this is the Crypto Franc (XCHF).
     * Care needs to be taken if another currency is used.
     * In particular we assume that the currency satifies either:
     * 1) Token transfer return true if and only if the transfer succeeded
     * OR 
     * 2) Token transfers throw an exception if the transfer fails
     */

    constructor(address wrappedToken, address xchfAddress, address offerFeeRecipient)
        ERC20Draggable(wrappedToken, UPDATE_QUORUM, ACQUISITION_QUORUM, xchfAddress, offerFeeRecipient, OFFER_FEE) public {
        IClaimable(wrappedToken).setClaimable(false);
    }

    function getClaimDeleter() public returns (address) {
        return IClaimable(getWrappedContract()).getClaimDeleter();
    }

    function getCollateralRate(address collateralType) public view returns (uint256) {
        uint256 rate = super.getCollateralRate(collateralType);
        if (rate > 0) {
            return rate;
        } else if (collateralType == getWrappedContract()) {
            return unwrapConversionFactor;
        } else {
            // If the wrapped contract allows for a specific collateral, we should too.
            // If the wrapped contract is not IClaimable, we will fail here, but would fail anyway.
            return IClaimable(getWrappedContract()).getCollateralRate(collateralType).mul(unwrapConversionFactor);
        }
    }

}


contract IClaimable {
    function setClaimable(bool) public;
    function getCollateralRate(address) public view returns (uint256);
    function getClaimDeleter() public returns (address);
}