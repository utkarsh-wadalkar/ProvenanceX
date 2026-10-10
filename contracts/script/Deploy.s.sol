// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ContentPassport} from "../src/ContentPassport.sol";

interface VmDeploy {
    function envUint(string calldata name) external returns (uint256 value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

/// @notice Deploys ContentPassport using PRIVATE_KEY without printing or persisting the key.
contract Deploy {
    VmDeploy private constant vm = VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CONSOLE = address(0x000000000000000000636F6e736F6c652e6c6f67);

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(privateKey);
        ContentPassport deployed = new ContentPassport();
        vm.stopBroadcast();
        _log(abi.encodeWithSignature("log(address)", address(deployed)));
        // This is the script simulation's current block; the exporter records the receipt block.
        _log(abi.encodeWithSignature("log(uint256)", block.number));
    }

    function _log(bytes memory payload) private view {
        (bool success,) = CONSOLE.staticcall(payload);
        success;
    }
}
