// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SpawnMarket} from "./SpawnMarket.sol";

/// @title SpawnBuybackVault
/// @notice Holds protocol BOT and permissionlessly buys SPAWN to burn (Pons-style).
contract SpawnBuybackVault is ReentrancyGuard {
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    SpawnMarket public immutable market;
    IERC20 public immutable spawn;

    event BuybackExecuted(address indexed caller, uint256 botSpent, uint256 spawnBurned);
    event Received(address indexed from, uint256 amount);

    error BadAmount();

    constructor(address market_, address spawn_) {
        require(market_ != address(0) && spawn_ != address(0), "ZERO");
        market = SpawnMarket(payable(market_));
        spawn = IERC20(spawn_);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /// @notice Spend vault BOT to buy SPAWN on SpawnMarket and send to dead address.
    function buyAndBurn(uint256 botIn, uint256 minSpawnOut)
        external
        nonReentrant
        returns (uint256 spawnBurned)
    {
        if (botIn == 0 || botIn > address(this).balance) revert BadAmount();
        spawnBurned = market.buySpawn{value: botIn}(minSpawnOut);
        require(spawn.transfer(BURN, spawnBurned), "BURN");
        emit BuybackExecuted(msg.sender, botIn, spawnBurned);
    }

    function quoteBuyAndBurn(uint256 botIn) external view returns (uint256) {
        return market.quoteBuySpawn(botIn);
    }
}
