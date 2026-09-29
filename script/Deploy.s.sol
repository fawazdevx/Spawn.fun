// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SPAWN} from "../src/SPAWN.sol";
import {SpawnMarket} from "../src/SpawnMarket.sol";
import {SpawnBuybackVault} from "../src/SpawnBuybackVault.sol";
import {SpawnFeeRouter} from "../src/SpawnFeeRouter.sol";
import {SpawnFactory} from "../src/SpawnFactory.sol";

/// @notice Deploy Spawn economy + factory to BOT Chain testnet or mainnet.
///
/// Deploys: SPAWN → SpawnMarket (seeded) → BuybackVault → FeeRouter → SpawnFactory
///
/// Testnet (use --slow on flaky RPCs to avoid nonce races):
///   BOT_SEED=2000000000000000000 forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $BOT_TESTNET_RPC_URL \
///     --chain-id $BOT_TESTNET_CHAIN_ID \
///     --account deploytestKey \
///     --sender $OWNER_ADDRESS \
///     --broadcast --slow \
///     -vvv
///
/// Deployer needs BOT_SEED + ~0.2 BOT gas. Default seed is 5 BOT — lower BOT_SEED if underfunded.
///
/// If SPAWN lands but later txs fail (nonce race), do NOT --resume. Use FinishDeploy.s.sol
/// with EXISTING_SPAWN=<spawn address> instead — resume would approve/seed stale addresses.
contract Deploy is Script {
    function run() external {
        address opsTreasury = vm.envOr("TREASURY", msg.sender);
        uint256 threshold = vm.envOr("GRADUATION_THRESHOLD", uint256(1 ether));
        // Seed SPAWN/BOT market for buybacks
        uint256 botSeed = vm.envOr("BOT_SEED", uint256(5 ether));
        uint256 spawnSeed = vm.envOr("SPAWN_SEED", uint256(50_000_000 ether));

        console2.log("Deployer", msg.sender);
        console2.log("Ops treasury", opsTreasury);
        console2.log("Graduation threshold (wei)", threshold);
        console2.log("Market BOT seed", botSeed);
        console2.log("Market SPAWN seed", spawnSeed);
        console2.log("Chain id", block.chainid);

        uint256 bal = msg.sender.balance;
        if (bal < botSeed + 0.15 ether) {
            console2.log("WARNING: deployer balance may be too low for seed+gas");
            console2.log("  balance", bal);
            console2.log("  need roughly", botSeed + 0.15 ether);
        }

        vm.startBroadcast();

        SPAWN spawnToken = new SPAWN(msg.sender);
        SpawnMarket market = new SpawnMarket(address(spawnToken));
        SpawnBuybackVault vault = new SpawnBuybackVault(address(market), address(spawnToken));
        SpawnFeeRouter router = new SpawnFeeRouter(address(vault), opsTreasury);

        spawnToken.approve(address(market), spawnSeed);
        market.seed{value: botSeed}(spawnSeed);

        SpawnFactory factory = new SpawnFactory(address(router), threshold);

        vm.stopBroadcast();

        console2.log("--- Deployed ---");
        console2.log("SPAWN", address(spawnToken));
        console2.log("SpawnMarket", address(market));
        console2.log("SpawnBuybackVault", address(vault));
        console2.log("SpawnFeeRouter", address(router));
        console2.log("SpawnFactory", address(factory));
        console2.log("Set frontend:");
        console2.log("  VITE_FACTORY_ADDRESS=", address(factory));
        console2.log("  VITE_SPAWN_TOKEN=", address(spawnToken));
        console2.log("  VITE_SPAWN_MARKET=", address(market));
        console2.log("  VITE_BUYBACK_VAULT=", address(vault));
        console2.log("  VITE_FEE_ROUTER=", address(router));
    }
}
