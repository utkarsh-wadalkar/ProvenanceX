// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ContentPassport} from "../src/ContentPassport.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function roll(uint256 newHeight) external;
    function expectRevert(bytes4 selector) external;
    function expectPartialRevert(bytes4 selector) external;
}

contract ContentPassportTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant CREATOR_KEY = 0xA11CE;
    uint256 private constant OTHER_KEY = 0xB0B;
    bytes32 private constant TYPEHASH =
        keccak256("Register(bytes32 contentHash,string tool,string metadataURI)");
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant NAME_HASH = keccak256("ProvenanceX");
    bytes32 private constant VERSION_HASH = keccak256("1");

    ContentPassport private passport;

    function setUp() public {
        passport = new ContentPassport();
    }

    function testRegisterAndVerify() public {
        bytes32 contentHash = keccak256("image bytes");
        bytes32 id = _register(CREATOR_KEY, contentHash, 0x1234, "Gemini", "ipfs://meta", bytes32(0));
        (bool exists, bytes32 foundId, ContentPassport.Passport memory p) = passport.verifyByHash(contentHash);
        _assertTrue(exists);
        _assertEq(id, foundId);
        _assertEq(contentHash, p.contentHash);
        _assertEq(uint256(p.perceptualHash), 0x1234);
        _assertEq(p.creator, vm.addr(CREATOR_KEY));
        _assertEq(p.tool, "Gemini");
        _assertEq(p.metadataURI, "ipfs://meta");
        _assertEq(uint256(p.createdAt), block.timestamp);
        _assertEq(p.parentId, bytes32(0));
        _assertFalse(p.revoked);
        _assertEq(passport.totalPassports(), 1);
        _assertEq(passport.trailLength(id), 1);
        ContentPassport.TrailEntry[] memory trail = passport.getTrailPage(id, 0, 1);
        _assertEq(trail.length, 1);
        _assertEq(trail[0].eventType, "REGISTERED");
        _assertEq(trail[0].dataHash, contentHash);
        _assertEq(trail[0].actor, vm.addr(CREATOR_KEY));
        _assertEq(trail[0].previousHead, bytes32(0));
        _assertEq(trail[0].trailHead, p.trailHead);
        _assertEq(trail[0].timestamp, p.createdAt);
        _assertEq(uint256(trail[0].blockNumber), block.number);
        (exists,,) = passport.verifyByHash(keccak256("missing"));
        _assertFalse(exists);
    }

    function testDuplicateContentReverts() public {
        bytes32 contentHash = keccak256("same bytes");
        bytes32 id = _register(CREATOR_KEY, contentHash, 0, "Gemini", "", bytes32(0));
        vm.expectPartialRevert(ContentPassport.AlreadyRegistered.selector);
        _register(OTHER_KEY, contentHash, 0, "Gemini", "", bytes32(0));
        _assertEq(passport.passportIdByContentHash(contentHash), id);
    }

    function testBadSignatureReverts() public {
        bytes32 contentHash = keccak256("bad signature");
        bytes memory badSig = _signature(CREATOR_KEY, contentHash, "Other tool", "");
        vm.prank(vm.addr(CREATOR_KEY));
        vm.expectRevert(ContentPassport.Unauthorized.selector);
        passport.register(contentHash, 0, "Gemini", "", bytes32(0), badSig);
    }

    function testDifferentSignerReverts() public {
        bytes32 contentHash = keccak256("different signer");
        bytes memory sig = _signature(OTHER_KEY, contentHash, "Gemini", "");
        vm.prank(vm.addr(CREATOR_KEY));
        vm.expectRevert(ContentPassport.Unauthorized.selector);
        passport.register(contentHash, 0, "Gemini", "", bytes32(0), sig);
    }

    function testMissingParentReverts() public {
        vm.expectPartialRevert(ContentPassport.ParentNotFound.selector);
        _register(CREATOR_KEY, keccak256("orphan"), 0, "Gemini", "", bytes32(uint256(9)));
    }

    function testDerivativeChainAndChildren() public {
        bytes32 parent = _register(CREATOR_KEY, keccak256("original"), 0, "Gemini", "", bytes32(0));
        bytes32 child = _register(CREATOR_KEY, keccak256("edit one"), 1, "Photoshop", "", parent);
        bytes32 grandchild = _register(CREATOR_KEY, keccak256("edit two"), 2, "Photoshop", "", child);
        bytes32[] memory children = passport.getChildren(parent);
        _assertEq(children.length, 1);
        _assertEq(children[0], child);
        _assertEq(passport.getPassport(grandchild).parentId, child);
    }

    function testUnauthorizedAppendReverts() public {
        bytes32 id = _register(CREATOR_KEY, keccak256("protected"), 0, "Gemini", "", bytes32(0));
        vm.prank(vm.addr(OTHER_KEY));
        vm.expectRevert(ContentPassport.Unauthorized.selector);
        passport.appendEvent(id, "EDITED", keccak256("edit"));
    }

    function testAuthorizedOperatorCanAppend() public {
        address creator = vm.addr(CREATOR_KEY);
        address operator = vm.addr(OTHER_KEY);
        bytes32 id = _register(CREATOR_KEY, keccak256("operator"), 0, "Gemini", "", bytes32(0));
        vm.prank(creator);
        passport.authorize(id, operator, true);
        _assertTrue(passport.operators(id, operator));
        vm.prank(operator);
        passport.appendEvent(id, "EDITED", keccak256("revision"));
        _assertEq(passport.trailLength(id), 2);
        vm.prank(creator);
        passport.authorize(id, operator, false);
        _assertFalse(passport.operators(id, operator));
    }

    function testTrailHashChainCanBeRecomputedFromPages() public {
        bytes32 contentHash = keccak256("trail source");
        bytes32 id = _register(CREATOR_KEY, contentHash, 0, "Gemini", "", bytes32(0));
        uint256 registeredBlock = block.number;
        vm.roll(registeredBlock + 2);
        vm.prank(vm.addr(CREATOR_KEY));
        passport.appendEvent(id, "EDITED", keccak256("edit payload"));
        uint256 editBlock = block.number;
        vm.roll(editBlock + 3);
        vm.prank(vm.addr(CREATOR_KEY));
        passport.appendEvent(id, "PUBLISHED", keccak256("publish payload"));

        ContentPassport.TrailEntry[] memory first = passport.getTrailPage(id, 0, 2);
        ContentPassport.TrailEntry[] memory second = passport.getTrailPage(id, 2, 10);
        _assertEq(first.length, 2);
        _assertEq(second.length, 1);
        _assertEq(uint256(first[0].blockNumber), registeredBlock);
        _assertEq(uint256(first[1].blockNumber), editBlock);
        _assertEq(uint256(second[0].blockNumber), block.number);
        bytes32 computed;
        for (uint256 i; i < first.length; ++i) {
            _assertEq(first[i].previousHead, computed);
            computed = keccak256(abi.encode(computed, first[i].eventType, first[i].dataHash, uint256(first[i].timestamp)));
            _assertEq(first[i].trailHead, computed);
        }
        _assertEq(second[0].previousHead, computed);
        computed = keccak256(abi.encode(computed, second[0].eventType, second[0].dataHash, uint256(second[0].timestamp)));
        _assertEq(second[0].trailHead, computed);
        _assertEq(passport.getPassport(id).trailHead, computed);
    }

    function testRevokeBlocksAppend() public {
        bytes32 id = _register(CREATOR_KEY, keccak256("revoke"), 0, "Gemini", "", bytes32(0));
        vm.prank(vm.addr(CREATOR_KEY));
        passport.revoke(id);
        _assertTrue(passport.getPassport(id).revoked);
        vm.prank(vm.addr(CREATOR_KEY));
        vm.expectPartialRevert(ContentPassport.PassportRevoked.selector);
        passport.appendEvent(id, "EDITED", keccak256("late edit"));
    }

    function testStringLengthLimits() public {
        _register(CREATOR_KEY, keccak256("max strings"), 0, new string(64), new string(256), bytes32(0));
        vm.expectPartialRevert(ContentPassport.ToolTooLong.selector);
        _register(CREATOR_KEY, keccak256("long tool"), 0, new string(65), "", bytes32(0));
        vm.expectPartialRevert(ContentPassport.MetadataURITooLong.selector);
        _register(CREATOR_KEY, keccak256("long URI"), 0, "Gemini", new string(257), bytes32(0));
    }

    function testPagePaginationAndBounds() public {
        bytes32 first = _register(CREATOR_KEY, keccak256("page one"), 11, "Gemini", "", bytes32(0));
        bytes32 second = _register(CREATOR_KEY, keccak256("page two"), 22, "Gemini", "", bytes32(0));
        (bytes32[] memory ids, uint64[] memory hashes, bytes32[] memory contentHashes) = passport.getPage(0, 1);
        _assertEq(ids.length, 1);
        _assertEq(ids[0], first);
        _assertEq(uint256(hashes[0]), 11);
        _assertEq(contentHashes[0], keccak256("page one"));
        (ids,,) = passport.getPage(1, 500);
        _assertEq(ids.length, 1);
        _assertEq(ids[0], second);
        (ids,,) = passport.getPage(2, 1);
        _assertEq(ids.length, 0);
        (ids,,) = passport.getPage(0, 0);
        _assertEq(ids.length, 0);
        ContentPassport.TrailEntry[] memory emptyTrail = passport.getTrailPage(first, 1, 1);
        _assertEq(emptyTrail.length, 0);
        emptyTrail = passport.getTrailPage(first, 0, 0);
        _assertEq(emptyTrail.length, 0);
        _assertEq(passport.getChildren(first).length, 0);
    }

    function testUnknownPassportViewsRevert() public {
        bytes32 missing = bytes32(uint256(42));
        vm.expectPartialRevert(ContentPassport.PassportNotFound.selector);
        passport.getPassport(missing);
        vm.expectPartialRevert(ContentPassport.PassportNotFound.selector);
        passport.trailLength(missing);
        vm.expectPartialRevert(ContentPassport.PassportNotFound.selector);
        passport.getTrailPage(missing, 0, 1);
        vm.expectPartialRevert(ContentPassport.PassportNotFound.selector);
        passport.authorize(missing, address(1), true);
        vm.expectPartialRevert(ContentPassport.PassportNotFound.selector);
        passport.revoke(missing);
    }

    function testOnlyCreatorCanManagePassport() public {
        bytes32 id = _register(CREATOR_KEY, keccak256("creator only"), 0, "Gemini", "", bytes32(0));
        vm.prank(vm.addr(OTHER_KEY));
        vm.expectRevert(ContentPassport.Unauthorized.selector);
        passport.authorize(id, address(7), true);
        vm.prank(vm.addr(OTHER_KEY));
        vm.expectRevert(ContentPassport.Unauthorized.selector);
        passport.revoke(id);
    }

    function testHammingDistanceKnownVectors() public view {
        _assertEq(uint256(passport.hammingDistance(0, 0)), 0);
        _assertEq(uint256(passport.hammingDistance(type(uint64).max, 0)), 64);
        _assertEq(uint256(passport.hammingDistance(0xF0, 0x0F)), 8);
        _assertEq(uint256(passport.hammingDistance(0x8000000000000000, 0)), 1);
    }

    function testFuzzHammingDistanceProperties(uint64 a, uint64 b) public view {
        _assertEq(uint256(passport.hammingDistance(a, b)), uint256(passport.hammingDistance(b, a)));
        _assertEq(uint256(passport.hammingDistance(a, a)), 0);
    }

    function _register(
        uint256 privateKey,
        bytes32 contentHash,
        uint64 perceptualHash,
        string memory tool,
        string memory uri,
        bytes32 parentId
    ) private returns (bytes32 id) {
        address creator = vm.addr(privateKey);
        bytes memory sig = _signature(privateKey, contentHash, tool, uri);
        vm.prank(creator);
        id = passport.register(contentHash, perceptualHash, tool, uri, parentId, sig);
    }

    function _signature(uint256 privateKey, bytes32 contentHash, string memory tool, string memory uri)
        private
        returns (bytes memory)
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(passport))
        );
        bytes32 structHash = keccak256(
            abi.encode(TYPEHASH, contentHash, keccak256(bytes(tool)), keccak256(bytes(uri)))
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _assertTrue(bool value) private pure { require(value, "expected true"); }
    function _assertFalse(bool value) private pure { require(!value, "expected false"); }
    function _assertEq(uint256 a, uint256 b) private pure { require(a == b, "uint mismatch"); }
    function _assertEq(address a, address b) private pure { require(a == b, "address mismatch"); }
    function _assertEq(bytes32 a, bytes32 b) private pure { require(a == b, "bytes32 mismatch"); }
    function _assertEq(string memory a, string memory b) private pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), "string mismatch");
    }
}
