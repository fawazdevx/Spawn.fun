// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SPAWN} from "../src/SPAWN.sol";
import {SpawnMarket} from "../src/SpawnMarket.sol";
import {SpawnBuybackVault} from "../src/SpawnBuybackVault.sol";
import {SpawnFeeRouter} from "../src/SpawnFeeRouter.sol";
import {SpawnFactory} from "../src/SpawnFactory.sol";
import {BondingCurve} from "../src/BondingCurve.sol";

contract SpawnBuybackTest is Test {
    address ops = makeAddr("ops");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    SPAWN spawnToken;
    SpawnMarket market;
    SpawnBuybackVault vault;
    SpawnFeeRouter router;
    SpawnFactory factory;

    address constant BURN = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(address(this), 100 ether);

        spawnToken = new SPAWN(address(this));
        market = new SpawnMarket(address(spawnToken));
        vault = new SpawnBuybackVault(address(market), address(spawnToken));
        router = new SpawnFeeRouter(address(vault), ops);
        factory = new SpawnFactory(address(router), 1 ether);

        // Seed SPAWN/BOT market: 10M SPAWN + 10 BOT
        uint256 seedSpawn = 10_000_000 ether;
        spawnToken.approve(address(market), seedSpawn);
        market.seed{value: 10 ether}(seedSpawn);
    }

    function test_FeeRouterSplits80_20() public {
        vm.deal(address(router), 10 ether);
        uint256 opsBefore = ops.balance;
        uint256 vaultBefore = address(vault).balance;

        router.distribute();

        assertEq(ops.balance - opsBefore, 2 ether);
        assertEq(address(vault).balance - vaultBefore, 8 ether);
        assertEq(address(router).balance, 0);
    }

    function test_BuyAndBurn() public {
        vm.deal(address(vault), 1 ether);
        uint256 burnedBefore = spawnToken.balanceOf(BURN);

        uint256 expected = vault.quoteBuyAndBurn(1 ether);
        assertGt(expected, 0);

        uint256 burned = vault.buyAndBurn(1 ether, expected);
        assertEq(burned, expected);
        assertEq(spawnToken.balanceOf(BURN), burnedBefore + burned);
        assertEq(address(vault).balance, 0);
    }

    function test_ProtocolFeesFlowToBuyback() public {
        vm.prank(alice);
        (, address curve) = factory.spawn("Flow", "FLW", "ipfs://f", "flow desc", address(0));
        vm.roll(block.number + 4);

        vm.prank(bob);
        BondingCurve(payable(curve)).buy{value: 1 ether}(0, address(0));

        uint256 protocolFees = BondingCurve(payable(curve)).protocolFees();
        assertGt(protocolFees, 0);

        BondingCurve(payable(curve)).claimProtocolFees();
        assertEq(address(router).balance, protocolFees);

        router.distribute();
        uint256 toBuyback = (protocolFees * 8_000) / 10_000;
        assertEq(address(vault).balance, toBuyback);

        uint256 burnedBefore = spawnToken.balanceOf(BURN);
        vault.buyAndBurn(toBuyback, 0);
        assertGt(spawnToken.balanceOf(BURN), burnedBefore);
    }

    function test_FactoryTreasuryIsRouter() public {
        vm.prank(alice);
        (, address curve) = factory.spawn("Treas", "TRS", "ipfs://t", "treasury check", address(0));
        assertEq(BondingCurve(payable(curve)).protocolTreasury(), address(router));
    }
}
