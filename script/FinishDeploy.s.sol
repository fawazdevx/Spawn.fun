// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SPAWN} from "../src/SPAWN.sol";
import {SpawnMarket} from "../src/SpawnMarket.sol";
import {SpawnBuybackVault} from "../src/SpawnBuybackVault.sol";
import {SpawnFeeRouter} from "../src/SpawnFeeRouter.sol";
import {SpawnFactory} from "../src/SpawnFactory.sol";

/// @notice Continue a partial Deploy after SPAWN is already on-chain (nonce race).
///
/// Do NOT use `forge script --resume` on the broken broadcast — approve/seed
/// would target stale simulated addresses.
///
///   EXISTING_SPAWN=0xde50… BOT_SEED=2000000000000000000 \
///   forge script script/FinishDeploy.s.sol:FinishDeploy \
///     --rpc-url $BOT_TESTNET_RPC_URL \
///     --chain-id 968 \
///     --account deploytestKey \
///     --sender $OWNER_ADDRESS \
///     --broadcast --slow \
///     -vvv
contract FinishDeploy is Script {
    function run() external {
        address spawnAddr = vm.envAddress("EXISTING_SPAWN");
        address opsTreasury = vm.envOr("TREASURY", msg.sender);
        uint256 threshold = vm.envOr("GRADUATION_THRESHOLD", uint256(1 ether));
        uint256 botSeed = vm.envOr("BOT_SEED", uint256(2 ether));
        uint256 spawnSeed = vm.envOr("SPAWN_SEED", uint256(50_000_000 ether));

        SPAWN spawnToken = SPAWN(spawnAddr);
        require(address(spawnToken).code.length > 0, "SPAWN has no code");
        require(spawnToken.balanceOf(msg.sender) >= spawnSeed, "insufficient SPAWN for seed");

        console2.log("Deployer", msg.sender);
        console2.log("Existing SPAWN", spawnAddr);
        console2.log("Ops treasury", opsTreasury);
        console2.log("Market BOT seed", botSeed);
        console2.log("Market SPAWN seed", spawnSeed);
        console2.log("Deployer BOT balance", msg.sender.balance);

        if (msg.sender.balance < botSeed + 0.15 ether) {
            console2.log("WARNING: balance may be too low for seed+gas");
        }

        vm.startBroadcast();

        SpawnMarket market = new SpawnMarket(spawnAddr);
        SpawnBuybackVault vault = new SpawnBuybackVault(address(market), spawnAddr);
        SpawnFeeRouter router = new SpawnFeeRouter(address(vault), opsTreasury);

        spawnToken.approve(address(market), spawnSeed);
        market.seed{value: botSeed}(spawnSeed);

        SpawnFactory factory = new SpawnFactory(address(router), threshold);

        vm.stopBroadcast();

        console2.log("--- Finished ---");
        console2.log("SPAWN", spawnAddr);
        console2.log("SpawnMarket", address(market));
        console2.log("SpawnBuybackVault", address(vault));
        console2.log("SpawnFeeRouter", address(router));
        console2.log("SpawnFactory", address(factory));
        console2.log("Set frontend:");
        console2.log("  VITE_FACTORY_ADDRESS=", address(factory));
        console2.log("  VITE_SPAWN_TOKEN=", spawnAddr);
        console2.log("  VITE_SPAWN_MARKET=", address(market));
        console2.log("  VITE_BUYBACK_VAULT=", address(vault));
        console2.log("  VITE_FEE_ROUTER=", address(router));
    }
}
