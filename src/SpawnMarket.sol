// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SpawnMarket
/// @notice Minimal constant-product BOT/SPAWN pool for protocol buybacks.
contract SpawnMarket is ReentrancyGuard {
    IERC20 public immutable spawn;
    uint256 public reserveBot;
    uint256 public reserveSpawn;

    event Seeded(uint256 botAmount, uint256 spawnAmount);
    event BuySpawn(address indexed buyer, uint256 botIn, uint256 spawnOut);
    event SellSpawn(address indexed seller, uint256 spawnIn, uint256 botOut);

    error BadAmount();
    error Slippage();
    error AlreadySeeded();
    error NotSeeded();

    constructor(address spawn_) {
        require(spawn_ != address(0), "SPAWN");
        spawn = IERC20(spawn_);
    }

    /// @notice Seed the pool once with SPAWN (pulled from msg.sender) + BOT (msg.value).
    function seed(uint256 spawnAmount) external payable nonReentrant {
        if (reserveBot != 0 || reserveSpawn != 0) revert AlreadySeeded();
        if (msg.value == 0 || spawnAmount == 0) revert BadAmount();
        require(spawn.transferFrom(msg.sender, address(this), spawnAmount), "TRANSFER");
        reserveBot = msg.value;
        reserveSpawn = spawnAmount;
        emit Seeded(msg.value, spawnAmount);
    }

    function quoteBuySpawn(uint256 botIn) public view returns (uint256 spawnOut) {
        if (botIn == 0 || reserveBot == 0 || reserveSpawn == 0) return 0;
        // x*y=k with 0 fee for buybacks (protocol volume)
        spawnOut = (botIn * reserveSpawn) / (reserveBot + botIn);
    }

    function quoteSellSpawn(uint256 spawnIn) public view returns (uint256 botOut) {
        if (spawnIn == 0 || reserveBot == 0 || reserveSpawn == 0) return 0;
        botOut = (spawnIn * reserveBot) / (reserveSpawn + spawnIn);
    }

    function buySpawn(uint256 minSpawnOut) external payable nonReentrant returns (uint256 spawnOut) {
        if (reserveBot == 0) revert NotSeeded();
        if (msg.value == 0) revert BadAmount();
        spawnOut = quoteBuySpawn(msg.value);
        if (spawnOut < minSpawnOut) revert Slippage();
        if (spawnOut == 0 || spawnOut >= reserveSpawn) revert BadAmount();

        reserveBot += msg.value;
        reserveSpawn -= spawnOut;
        require(spawn.transfer(msg.sender, spawnOut), "TRANSFER");
        emit BuySpawn(msg.sender, msg.value, spawnOut);
    }

    function sellSpawn(uint256 spawnIn, uint256 minBotOut) external nonReentrant returns (uint256 botOut) {
        if (reserveSpawn == 0) revert NotSeeded();
        if (spawnIn == 0) revert BadAmount();
        botOut = quoteSellSpawn(spawnIn);
        if (botOut < minBotOut) revert Slippage();
        if (botOut == 0 || botOut >= reserveBot) revert BadAmount();

        require(spawn.transferFrom(msg.sender, address(this), spawnIn), "TRANSFER");
        reserveSpawn += spawnIn;
        reserveBot -= botOut;
        (bool sent,) = payable(msg.sender).call{value: botOut}("");
        require(sent, "SEND");
        emit SellSpawn(msg.sender, spawnIn, botOut);
    }

    receive() external payable {
        revert("USE_BUY");
    }
}
