// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SpawnToken} from "./SpawnToken.sol";

/// @title BondingCurve
/// @notice Constant-product launch curve. After graduation, trading continues on the same
///         locked liquidity as an open AMM (pump.fun-style: venue changes in status, not a hard stop).
contract BondingCurve is ReentrancyGuard {
    uint256 public constant FEE_BPS = 125; // 1.25%
    uint256 public constant BPS = 10_000;
    uint256 public constant CREATOR_FEE_SHARE_BPS = 5_000; // 50% of fee
    uint256 public constant REFERRER_FEE_SHARE_BPS = 1_000; // 10% of fee

    uint256 public constant ANTI_SNIPE_BLOCKS = 3;
    uint256 public constant MAX_BUY_BPS_ANTI_SNIPE = 200; // 2% of total supply

    SpawnToken public immutable token;
    address public immutable creator;
    address public immutable protocolTreasury;
    address public immutable factory;

    uint256 public immutable virtualBotReserves;
    uint256 public immutable virtualTokenReserves;
    uint256 public immutable realTokenReserves; // tokens sold during bonding phase
    uint256 public immutable graduationThreshold;
    uint256 public immutable launchBlock;
    uint256 public immutable totalSupply;

    uint256 public realBotReserves;
    uint256 public tokensSold;
    bool public graduated;

    uint256 public creatorFees;
    uint256 public protocolFees;
    mapping(address => uint256) public referrerFees;

    event Buy(
        address indexed buyer,
        address indexed referrer,
        uint256 botIn,
        uint256 tokensOut,
        uint256 fee
    );
    event Sell(address indexed seller, uint256 tokensIn, uint256 botOut, uint256 fee);
    event Graduated(address indexed token, uint256 botLiquidity, uint256 tokenLiquidity);
    event FeesClaimed(address indexed account, uint256 amount);

    error Slippage();
    error AntiSnipe();
    error ZeroAmount();
    error InsufficientLiquidity();

    constructor(
        address token_,
        address creator_,
        address protocolTreasury_,
        address factory_,
        uint256 virtualBotReserves_,
        uint256 virtualTokenReserves_,
        uint256 realTokenReserves_,
        uint256 graduationThreshold_,
        uint256 totalSupply_
    ) {
        token = SpawnToken(token_);
        creator = creator_;
        protocolTreasury = protocolTreasury_;
        factory = factory_;
        virtualBotReserves = virtualBotReserves_;
        virtualTokenReserves = virtualTokenReserves_;
        realTokenReserves = realTokenReserves_;
        graduationThreshold = graduationThreshold_;
        totalSupply = totalSupply_;
        launchBlock = block.number;
    }

    receive() external payable {}

    function getReserves() public view returns (uint256 botReserves, uint256 tokenReserves) {
        botReserves = virtualBotReserves + realBotReserves;
        tokenReserves = virtualTokenReserves - tokensSold;
    }

    function getProgressBps() public view returns (uint256) {
        if (graduationThreshold == 0) return 0;
        uint256 p = (realBotReserves * BPS) / graduationThreshold;
        return p > BPS ? BPS : p;
    }

    /// @notice "bonding" before threshold, "amm" after graduation (trading stays open either way).
    function tradeVenue() external view returns (string memory) {
        return graduated ? "amm" : "bonding";
    }

    function quoteBuy(uint256 botIn) public view returns (uint256 tokensOut, uint256 fee) {
        if (botIn == 0) return (0, 0);
        fee = (botIn * FEE_BPS) / BPS;
        uint256 botAfterFee = botIn - fee;
        (uint256 botR, uint256 tokR) = getReserves();
        if (botR == 0 || tokR <= 1) return (0, fee);

        tokensOut = (botAfterFee * tokR) / (botR + botAfterFee);
        // Never empty the virtual pool
        if (tokensOut >= tokR) tokensOut = tokR - 1;

        if (!graduated) {
            uint256 remaining = realTokenReserves - tokensSold;
            if (tokensOut > remaining) tokensOut = remaining;
        }
    }

    function quoteSell(uint256 tokensIn) public view returns (uint256 botOut, uint256 fee) {
        if (tokensIn == 0) return (0, 0);
        (uint256 botR, uint256 tokR) = getReserves();
        if (tokR == 0 || botR == 0) return (0, 0);

        uint256 botGross = (tokensIn * botR) / (tokR + tokensIn);
        if (botGross > realBotReserves) botGross = realBotReserves;
        fee = (botGross * FEE_BPS) / BPS;
        botOut = botGross - fee;
    }

    function buy(uint256 minTokensOut, address referrer)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        return _buy(msg.sender, minTokensOut, referrer);
    }

    function buyFor(address beneficiary, uint256 minTokensOut, address referrer)
        external
        payable
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (msg.sender != factory) revert AntiSnipe();
        return _buy(beneficiary, minTokensOut, referrer);
    }

    function _buy(address beneficiary, uint256 minTokensOut, address referrer)
        internal
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert ZeroAmount();

        uint256 fee;
        (tokensOut, fee) = quoteBuy(msg.value);
        if (tokensOut < minTokensOut) revert Slippage();
        if (tokensOut == 0) revert InsufficientLiquidity();

        // Anti-snipe only during early bonding blocks
        if (!graduated) {
            _enforceAntiSnipe(beneficiary, tokensOut);
        }

        uint256 botAfterFee = msg.value - fee;
        _splitFees(fee, referrer, beneficiary);

        tokensSold += tokensOut;
        realBotReserves += botAfterFee;

        bool ok = token.transfer(beneficiary, tokensOut);
        require(ok, "TRANSFER");

        emit Buy(beneficiary, referrer, msg.value, tokensOut, fee);

        if (!graduated && realBotReserves >= graduationThreshold) {
            _graduate();
        }
    }

    function sell(uint256 tokensIn, uint256 minBotOut) external nonReentrant returns (uint256 botOut) {
        if (tokensIn == 0) revert ZeroAmount();

        uint256 fee;
        (botOut, fee) = quoteSell(tokensIn);
        if (botOut < minBotOut) revert Slippage();
        if (botOut == 0) revert InsufficientLiquidity();

        bool ok = token.transferFrom(msg.sender, address(this), tokensIn);
        require(ok, "TRANSFER_FROM");

        tokensSold -= tokensIn;
        realBotReserves -= (botOut + fee);
        _splitFees(fee, address(0), msg.sender);

        (bool sent,) = payable(msg.sender).call{value: botOut}("");
        require(sent, "BOT_SEND");

        emit Sell(msg.sender, tokensIn, botOut, fee);
    }

    function claimCreatorFees() external nonReentrant {
        uint256 amount = creatorFees;
        creatorFees = 0;
        (bool sent,) = payable(creator).call{value: amount}("");
        require(sent, "SEND");
        emit FeesClaimed(creator, amount);
    }

    function claimProtocolFees() external nonReentrant {
        uint256 amount = protocolFees;
        protocolFees = 0;
        (bool sent,) = payable(protocolTreasury).call{value: amount}("");
        require(sent, "SEND");
        emit FeesClaimed(protocolTreasury, amount);
    }

    function claimReferrerFees(address referrer) external nonReentrant {
        uint256 amount = referrerFees[referrer];
        referrerFees[referrer] = 0;
        (bool sent,) = payable(referrer).call{value: amount}("");
        require(sent, "SEND");
        emit FeesClaimed(referrer, amount);
    }

    function _enforceAntiSnipe(address beneficiary, uint256 tokensOut) internal view {
        uint256 blocksSince = block.number - launchBlock;
        if (blocksSince == 0) {
            if (beneficiary != creator) revert AntiSnipe();
            return;
        }
        if (blocksSince <= ANTI_SNIPE_BLOCKS) {
            uint256 maxBuy = (totalSupply * MAX_BUY_BPS_ANTI_SNIPE) / BPS;
            if (tokensOut > maxBuy) revert AntiSnipe();
        }
    }

    function _splitFees(uint256 fee, address referrer, address trader) internal {
        if (fee == 0) return;
        uint256 creatorCut = (fee * CREATOR_FEE_SHARE_BPS) / BPS;
        uint256 referrerCut;
        if (referrer != address(0) && referrer != trader && referrer != creator) {
            referrerCut = (fee * REFERRER_FEE_SHARE_BPS) / BPS;
            referrerFees[referrer] += referrerCut;
        }
        uint256 protocolCut = fee - creatorCut - referrerCut;
        creatorFees += creatorCut;
        protocolFees += protocolCut;
    }

    /// @dev Graduation is a status + LP lock milestone. Trading continues on this AMM.
    function _graduate() internal {
        if (graduated) return;
        graduated = true;
        uint256 tokenLiquidity = totalSupply - tokensSold;
        emit Graduated(address(token), realBotReserves, tokenLiquidity);
    }
}
