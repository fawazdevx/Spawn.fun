// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SpawnFactory} from "../src/SpawnFactory.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {SpawnToken} from "../src/SpawnToken.sol";

contract SpawnFactoryTest is Test {
    SpawnFactory factory;
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address referrer = makeAddr("referrer");

    uint256 constant GRAD_THRESHOLD = 1 ether;

    function setUp() public {
        factory = new SpawnFactory(treasury, GRAD_THRESHOLD);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function test_SpawnCreatesTokenAndCurve() public {
        vm.prank(alice);
        (address token, address curve) = factory.spawn("Cat Coin", "CAT", "ipfs://img", "meow", address(0));

        assertTrue(token != address(0));
        assertTrue(curve != address(0));
        assertEq(SpawnToken(token).name(), "Cat Coin");
        assertEq(SpawnToken(token).symbol(), "CAT");
        assertEq(SpawnToken(token).totalSupply(), factory.TOTAL_SUPPLY());
        assertEq(SpawnToken(token).balanceOf(curve), factory.TOTAL_SUPPLY());
        assertEq(factory.launchCount(), 1);

        SpawnFactory.Launch memory launch = factory.getLaunch(1);
        assertEq(launch.creator, alice);
        assertEq(launch.token, token);
        assertEq(launch.curve, curve);
    }

    function test_SpawnWithSeedBuy() public {
        vm.prank(alice);
        (address token, address curve) =
            factory.spawn{value: 0.1 ether}("Dog", "DOG", "ipfs://dog", "woof", address(0));

        uint256 bal = SpawnToken(token).balanceOf(alice);
        assertGt(bal, 0);
        assertEq(BondingCurve(payable(curve)).realBotReserves(), 0.1 ether - (0.1 ether * 125) / 10_000);
    }

    function test_BuyAndSell() public {
        vm.prank(alice);
        (address token, address curve) = factory.spawn("Frog", "FROG", "ipfs://img", "desc", address(0));

        // Move past anti-snipe block 0
        vm.roll(block.number + 1);

        vm.prank(bob);
        BondingCurve(payable(curve)).buy{value: 0.05 ether}(0, referrer);
        uint256 bobTokens = SpawnToken(token).balanceOf(bob);
        assertGt(bobTokens, 0);

        vm.prank(bob);
        SpawnToken(token).approve(curve, bobTokens);
        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        uint256 botOut = BondingCurve(payable(curve)).sell(bobTokens / 2, 0);
        assertGt(botOut, 0);
        assertEq(bob.balance, bobBefore + botOut);
    }

    function test_AntiSnipeBlocksNonCreatorOnLaunchBlock() public {
        vm.prank(alice);
        (, address curve) = factory.spawn("Snipe", "SNP", "ipfs://img", "desc", address(0));

        vm.prank(bob);
        vm.expectRevert(BondingCurve.AntiSnipe.selector);
        BondingCurve(payable(curve)).buy{value: 0.01 ether}(0, address(0));
    }

    function test_CreatorFeesAccrueAndClaim() public {
        vm.prank(alice);
        (, address curve) = factory.spawn("Fee", "FEE", "ipfs://img", "desc", address(0));
        vm.roll(block.number + 4);

        vm.prank(bob);
        BondingCurve(payable(curve)).buy{value: 1 ether}(0, address(0));

        uint256 fees = BondingCurve(payable(curve)).creatorFees();
        assertGt(fees, 0);

        uint256 before = alice.balance;
        vm.prank(alice);
        BondingCurve(payable(curve)).claimCreatorFees();
        assertEq(alice.balance, before + fees);
        assertEq(BondingCurve(payable(curve)).creatorFees(), 0);
    }

    function test_GraduationKeepsTradingOpen() public {
        vm.prank(alice);
        (address token, address curve) = factory.spawn("Grad", "GRD", "ipfs://img", "desc", address(0));
        vm.roll(block.number + 4);

        vm.prank(bob);
        BondingCurve(payable(curve)).buy{value: 1.02 ether}(0, address(0));

        assertTrue(BondingCurve(payable(curve)).graduated());
        assertTrue(BondingCurve(payable(curve)).getProgressBps() >= 10_000);
        assertEq(
            keccak256(bytes(BondingCurve(payable(curve)).tradeVenue())),
            keccak256(bytes("amm"))
        );

        // Trading continues after graduation (Spawn AMM / locked LP)
        uint256 before = SpawnToken(token).balanceOf(bob);
        vm.prank(bob);
        BondingCurve(payable(curve)).buy{value: 0.05 ether}(0, address(0));
        assertGt(SpawnToken(token).balanceOf(bob), before);

        uint256 bal = SpawnToken(token).balanceOf(bob);
        vm.prank(bob);
        SpawnToken(token).approve(curve, bal);
        vm.prank(bob);
        uint256 botOut = BondingCurve(payable(curve)).sell(bal / 4, 0);
        assertGt(botOut, 0);

        assertEq(tokenId_safe(token), 1);
    }

    function tokenId_safe(address token) internal view returns (uint256) {
        return factory.tokenId(token);
    }

    function test_ReferrerFees() public {
        vm.prank(alice);
        (, address curve) = factory.spawn("Ref", "REF", "ipfs://img", "desc", address(0));
        vm.roll(block.number + 4);

        vm.prank(bob);
        BondingCurve(payable(curve)).buy{value: 1 ether}(0, referrer);

        uint256 refFees = BondingCurve(payable(curve)).referrerFees(referrer);
        assertGt(refFees, 0);

        uint256 before = referrer.balance;
        BondingCurve(payable(curve)).claimReferrerFees(referrer);
        assertEq(referrer.balance, before + refFees);
    }

    function test_SpawnRequiresImageAndDescription() public {
        vm.prank(alice);
        vm.expectRevert(SpawnFactory.BadImage.selector);
        factory.spawn("NoImg", "NIM", "", "has desc", address(0));

        vm.prank(alice);
        vm.expectRevert(SpawnFactory.BadDescription.selector);
        factory.spawn("NoDesc", "NDC", "ipfs://x", "", address(0));

        vm.prank(alice);
        vm.expectRevert(SpawnFactory.BadImage.selector);
        factory.spawn("SpacesImg", "SPI", "   ", "has desc", address(0));

        vm.prank(alice);
        vm.expectRevert(SpawnFactory.BadDescription.selector);
        factory.spawn("SpacesDesc", "SPD", "ipfs://x", "  \n\t ", address(0));
    }

    function test_SpawnRejectsDuplicateNameAndSymbol() public {
        vm.prank(alice);
        factory.spawn("Unique Cat", "UCAT", "ipfs://a", "first", address(0));

        vm.prank(bob);
        vm.expectRevert(SpawnFactory.NameTaken.selector);
        factory.spawn("unique cat", "OTHER", "ipfs://b", "dup name", address(0));

        vm.prank(bob);
        vm.expectRevert(SpawnFactory.SymbolTaken.selector);
        factory.spawn("Different", "ucat", "ipfs://c", "dup ticker", address(0));

        assertTrue(factory.isNameTaken("UNIQUE CAT"));
        assertTrue(factory.isSymbolTaken("ucat"));
        assertFalse(factory.isNameTaken("Fresh Name"));
    }
}

