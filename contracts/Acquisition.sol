pragma solidity ^0.5.10;

import "./SafeMath.sol";
import "./IERC20.sol";
import "./SafeMath.sol";

/**
 * @title Acquisition Attempt
 * @author Benjamin Rickenbacher, benjamin@alethena.com
 * @author Luzius Meisser, luzius@meissereconomics.com
 *
 */


contract Acquisition {

    using SafeMath for uint256;

    uint256 public constant votingPeriod = 60 * 60 * 24 * 30 * 2;    // 2months/60days
    uint256 public constant validityPeriod = 60 * 60 * 24 * 30 * 3;  // 3months/90days

    uint256 public quorum;                                // Percentage of votes needed to start drag-along process

    address private parent;                         // the parent contract
    address payable public buyer;                          // the person who made the offer
    uint256 public price;                  // the price offered per share (in XCHF base units, so 10**18 is 1 XCHF)
    uint256 public timestamp;                      // the timestamp of the block in which the acquisition was created

    uint256 public noVotes;                        // number of tokens voting for no
    uint256 public yesVotes;                       // number of tokens voting for yes

    mapping (address => int8) private votes;               // +1 means yes, -1 means no

    constructor (address payable buyer_, uint256 price_, uint256 quorum_) public {
        require(price_ > 0, "Price cannot be zero");
        parent = msg.sender;
        buyer = buyer_;
        price = price_;
        quorum = quorum_;
        timestamp = block.timestamp;
    }

    function isWellFunded(address currency_, uint256 sharesToAcquire) public view returns (bool) {
        IERC20 currency = IERC20(currency_);
        uint256 buyerXCHFBalance = currency.balanceOf(buyer);
        uint256 buyerXCHFAllowance = currency.allowance(buyer, parent);
        uint256 xchfNeeded = sharesToAcquire.mul(price);
        return xchfNeeded <= buyerXCHFBalance && xchfNeeded <= buyerXCHFAllowance;
    }

    // function canStillGetEnoughVotes() public view returns (bool) {
    //     return !quorumHasFailed();
    // }

    function isQuorumReached() public view returns (bool) {
        if (isVotingOpen()) {
            // is it already clear that 75% will vote yes even though the vote is not over yet?
            return yesVotes.mul(10000).div(IERC20(parent).totalSupply()) >= quorum;
        } else {
            // did 75% of all cast votes say 'yes'?
            return yesVotes.mul(10000).div(yesVotes.add(noVotes)) >= quorum;
        }
    }

    function quorumHasFailed() public view returns (bool) {
        if (isVotingOpen()) {
            // is it already clear that 25% will vote no even though the vote is not over yet?
            return (IERC20(parent).totalSupply().sub(noVotes)).mul(10000).div(IERC20(parent).totalSupply()) < quorum;
        } else {
            // did 25% of all cast votes say 'no'?
            return yesVotes.mul(10000).div(yesVotes.add(noVotes)) < quorum;
        }
    }

    function adjustVotes(address from, address to, uint256 value) public parentOnly() {
        if (isVotingOpen()) {
            int fromVoting = votes[from];
            int toVoting = votes[to];
            update(fromVoting, toVoting, value);
        }
    }

    function update(int previousVote, int newVote, uint256 votes_) internal {
        if (previousVote == -1) {
            noVotes = noVotes.sub(votes_);
        } else if (previousVote == 1) {
            yesVotes = yesVotes.sub(votes_);
        }
        if (newVote == -1) {
            noVotes = noVotes.add(votes_);
        } else if (newVote == 1) {
            yesVotes = yesVotes.add(votes_);
        }
    }

    function isVotingOpen() public view returns (bool) {
        uint256 age = block.timestamp.sub(timestamp);
        return age <= votingPeriod;
    }

    function hasExpired() public view returns (bool) {
        uint256 age = block.timestamp.sub(timestamp);
        return age > validityPeriod;
    }

    modifier votingOpen() {
        require(isVotingOpen(), "The vote has ended.");
        _;
    }

    function voteYes(address sender, uint256 votes_) public parentOnly() votingOpen() {
        vote(1, votes_, sender);
    }

    function voteNo(address sender, uint256 votes_) public parentOnly() votingOpen() {
        vote(-1, votes_, sender);
    }

    function vote(int8 yesOrNo, uint256 votes_, address voter) internal {
        int8 previousVote = votes[voter];
        int8 newVote = yesOrNo;
        votes[voter] = newVote;
        update(previousVote, newVote, votes_);
    }

    function hasVotedYes(address voter) public view returns (bool) {
        return votes[voter] == 1;
    }

    function hasVotedNo(address voter) public view returns (bool) {
        return votes[voter] == -1;
    }

    function kill() public parentOnly() {
        /// destroy the contract and send leftovers to the buyer.
        selfdestruct(buyer);
    }

    modifier parentOnly () {
        require(msg.sender == parent, "Can only be called by parent contract");
        _;
    }
}