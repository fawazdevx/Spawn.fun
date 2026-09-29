// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SpawnToken
/// @notice Fixed-supply ERC20 for Spawn.fun launches. Entire supply minted once at deploy.
contract SpawnToken is ERC20 {
    address public curve;
    address public immutable factory;
    string public imageURI;
    string public description;

    error OnlyFactory();
    error CurveSet();

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageURI_,
        string memory description_,
        address factory_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        factory = factory_;
        imageURI = imageURI_;
        description = description_;
        _mint(factory_, totalSupply_);
    }

    function setCurve(address curve_) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (curve != address(0)) revert CurveSet();
        curve = curve_;
    }
}
