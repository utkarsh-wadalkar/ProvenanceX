// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title ContentPassport
/// @notice Registers content provenance and stores a paged, hash-chained audit trail.
contract ContentPassport is EIP712 {
    struct Passport {
        bytes32 contentHash;
        uint64 perceptualHash;
        address creator;
        string tool;
        string metadataURI;
        uint64 createdAt;
        bytes32 parentId;
        bytes32 trailHead;
        bool revoked;
    }

    struct TrailEntry {
        bytes32 previousHead;
        string eventType;
        bytes32 dataHash;
        bytes32 trailHead;
        address actor;
        uint64 timestamp;
        uint64 blockNumber;
    }

    bytes32 private constant REGISTER_TYPEHASH =
        keccak256("Register(bytes32 contentHash,string tool,string metadataURI)");
    /// @notice Maximum number of records returned by any paged read.
    uint256 public constant MAX_PAGE_SIZE = 200;

    /// @notice Registered passports, keyed by passport ID.
    mapping(bytes32 => Passport) public passports;
    /// @notice First passport registered for a content hash.
    mapping(bytes32 => bytes32) public passportIdByContentHash;
    /// @notice Whether an address may append events for a passport.
    mapping(bytes32 => mapping(address => bool)) public operators;
    bytes32[] private allIds;
    mapping(bytes32 => bytes32[]) private children;
    mapping(bytes32 => TrailEntry[]) private trailEntries;

    error AlreadyRegistered(bytes32 existingId);
    error ParentNotFound(bytes32 parentId);
    error Unauthorized();
    error PassportNotFound(bytes32 passportId);
    error PassportRevoked(bytes32 passportId);
    error ToolTooLong(uint256 length);
    error MetadataURITooLong(uint256 length);

    event PassportRegistered(
        bytes32 indexed passportId,
        address indexed creator,
        bytes32 indexed contentHash,
        uint64 perceptualHash,
        string tool,
        bytes32 parentId
    );
    event TrailEvent(
        bytes32 indexed passportId,
        string eventType,
        bytes32 dataHash,
        bytes32 trailHead,
        address indexed actor,
        uint256 timestamp
    );
    event OperatorSet(bytes32 indexed passportId, address indexed operator, bool allowed);
    event Revoked(bytes32 indexed passportId);

    /// @notice Creates a passport after verifying the creator's ProvenanceX EIP-712 signature.
    constructor() EIP712("ProvenanceX", "1") {}

    /// @notice Registers content once; the first creator of a content hash wins.
    function register(
        bytes32 contentHash,
        uint64 perceptualHash,
        string calldata tool,
        string calldata metadataURI,
        bytes32 parentId,
        bytes calldata sig
    ) external returns (bytes32 passportId) {
        bytes32 existingId = passportIdByContentHash[contentHash];
        if (existingId != bytes32(0)) revert AlreadyRegistered(existingId);
        if (bytes(tool).length > 64) revert ToolTooLong(bytes(tool).length);
        if (bytes(metadataURI).length > 256) revert MetadataURITooLong(bytes(metadataURI).length);
        if (parentId != bytes32(0) && passports[parentId].creator == address(0)) {
            revert ParentNotFound(parentId);
        }

        _verifyRegistration(contentHash, tool, metadataURI, sig);

        passportId = keccak256(abi.encode(contentHash, msg.sender, block.timestamp));
        _storePassport(passportId, contentHash, perceptualHash, tool, metadataURI, parentId);
        emit PassportRegistered(passportId, msg.sender, contentHash, perceptualHash, tool, parentId);
    }

    function _verifyRegistration(
        bytes32 contentHash,
        string calldata tool,
        string calldata metadataURI,
        bytes calldata sig
    ) private view {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    REGISTER_TYPEHASH,
                    contentHash,
                    keccak256(bytes(tool)),
                    keccak256(bytes(metadataURI))
                )
            )
        );
        if (ECDSA.recover(digest, sig) != msg.sender) revert Unauthorized();
    }

    function _storePassport(
        bytes32 passportId,
        bytes32 contentHash,
        uint64 perceptualHash,
        string calldata tool,
        string calldata metadataURI,
        bytes32 parentId
    ) private {
        uint64 timestamp = uint64(block.timestamp);
        bytes32 initialHead = keccak256(
            abi.encode(bytes32(0), "REGISTERED", contentHash, block.timestamp)
        );
        passports[passportId] = Passport({
            contentHash: contentHash,
            perceptualHash: perceptualHash,
            creator: msg.sender,
            tool: tool,
            metadataURI: metadataURI,
            createdAt: timestamp,
            parentId: parentId,
            trailHead: initialHead,
            revoked: false
        });
        passportIdByContentHash[contentHash] = passportId;
        allIds.push(passportId);
        if (parentId != bytes32(0)) children[parentId].push(passportId);

        trailEntries[passportId].push(
            TrailEntry(bytes32(0), "REGISTERED", contentHash, initialHead, msg.sender, timestamp, uint64(block.number))
        );
        emit TrailEvent(passportId, "REGISTERED", contentHash, initialHead, msg.sender, block.timestamp);
    }

    /// @notice Adds an audit event for the creator or an authorized operator.
    function appendEvent(bytes32 passportId, string calldata eventType, bytes32 dataHash) external {
        Passport storage p = passports[passportId];
        if (p.creator == address(0)) revert PassportNotFound(passportId);
        if (p.revoked) revert PassportRevoked(passportId);
        if (msg.sender != p.creator && !operators[passportId][msg.sender]) revert Unauthorized();

        bytes32 previousHead = p.trailHead;
        bytes32 nextHead = keccak256(abi.encode(previousHead, eventType, dataHash, block.timestamp));
        p.trailHead = nextHead;
        trailEntries[passportId].push(
            TrailEntry(previousHead, eventType, dataHash, nextHead, msg.sender, uint64(block.timestamp), uint64(block.number))
        );
        emit TrailEvent(passportId, eventType, dataHash, nextHead, msg.sender, block.timestamp);
    }

    /// @notice Grants or removes an operator's permission to append audit events.
    function authorize(bytes32 passportId, address operator, bool allowed) external {
        Passport storage p = passports[passportId];
        if (p.creator == address(0)) revert PassportNotFound(passportId);
        if (msg.sender != p.creator) revert Unauthorized();
        operators[passportId][operator] = allowed;
        emit OperatorSet(passportId, operator, allowed);
    }

    /// @notice Permanently revokes a passport and prevents further audit events.
    function revoke(bytes32 passportId) external {
        Passport storage p = passports[passportId];
        if (p.creator == address(0)) revert PassportNotFound(passportId);
        if (msg.sender != p.creator) revert Unauthorized();
        p.revoked = true;
        emit Revoked(passportId);
    }

    /// @notice Looks up a passport by its canonical content hash.
    function verifyByHash(bytes32 contentHash)
        external
        view
        returns (bool exists, bytes32 passportId, Passport memory p)
    {
        passportId = passportIdByContentHash[contentHash];
        exists = passportId != bytes32(0);
        if (exists) p = passports[passportId];
    }

    /// @notice Returns a passport, reverting when its ID is unknown.
    function getPassport(bytes32 passportId) external view returns (Passport memory p) {
        p = passports[passportId];
        if (p.creator == address(0)) revert PassportNotFound(passportId);
    }

    /// @notice Returns the direct derivatives registered for a passport.
    function getChildren(bytes32 passportId) external view returns (bytes32[] memory) {
        return children[passportId];
    }

    /// @notice Returns the number of registered passports.
    function totalPassports() external view returns (uint256) {
        return allIds.length;
    }

    /// @notice Returns a bounded page of IDs and their hashes; limits above 200 are capped.
    function getPage(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory ids, uint64[] memory perceptualHashes, bytes32[] memory contentHashes)
    {
        uint256 length = allIds.length;
        if (offset >= length || limit == 0) return (new bytes32[](0), new uint64[](0), new bytes32[](0));
        uint256 end = offset + _boundedLimit(limit);
        if (end > length) end = length;
        uint256 count = end - offset;
        ids = new bytes32[](count);
        perceptualHashes = new uint64[](count);
        contentHashes = new bytes32[](count);
        for (uint256 i; i < count; ++i) {
            bytes32 id = allIds[offset + i];
            Passport storage p = passports[id];
            ids[i] = id;
            perceptualHashes[i] = p.perceptualHash;
            contentHashes[i] = p.contentHash;
        }
    }

    /// @notice Returns the Hamming distance between two 64-bit perceptual hashes.
    function hammingDistance(uint64 a, uint64 b) external pure returns (uint8 distance) {
        uint64 value = a ^ b;
        while (value != 0) {
            value &= value - 1;
            ++distance;
        }
    }

    /// @notice Returns the number of audit trail entries, including REGISTERED.
    function trailLength(bytes32 passportId) external view returns (uint256) {
        if (passports[passportId].creator == address(0)) revert PassportNotFound(passportId);
        return trailEntries[passportId].length;
    }

    /// @notice Returns a bounded page of the stored audit trail, including REGISTERED as entry zero.
    function getTrailPage(bytes32 passportId, uint256 offset, uint256 limit)
        external
        view
        returns (TrailEntry[] memory entries)
    {
        if (passports[passportId].creator == address(0)) revert PassportNotFound(passportId);
        TrailEntry[] storage trail = trailEntries[passportId];
        if (offset >= trail.length || limit == 0) return new TrailEntry[](0);
        uint256 end = offset + _boundedLimit(limit);
        if (end > trail.length) end = trail.length;
        entries = new TrailEntry[](end - offset);
        for (uint256 i; i < entries.length; ++i) entries[i] = trail[offset + i];
    }

    function _boundedLimit(uint256 limit) private pure returns (uint256) {
        return limit > MAX_PAGE_SIZE ? MAX_PAGE_SIZE : limit;
    }
}
