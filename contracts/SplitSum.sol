// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract SplitSum {
    event UserProfileUpdated(address indexed userAddress, string name, string email);
    event GroupCreated(bytes32 indexed groupId, address indexed ownerAddress, string name, string description);

    struct UserProfile {
        address ownerAddress;
        string name;
        string email;
    }

    struct Group {
        bytes32 groupId;
        address ownerAddress;
        string name;
        string description;
    }

    struct Membership {
        address memberAddress;
        string name;
        int256 balance;
    }

    address private _owner;

    mapping(address => UserProfile) private _userProfiles;

    mapping(bytes32 => Group) private _groups;
    mapping(address => Group[]) private _ownedGroups;
    mapping(address => Group[]) private _membershipGroups;
    mapping(bytes32 => Membership[]) private _groupMemberships;

    constructor() {
        _owner = msg.sender;
    }

    function owner() external view returns (address) {
        return _owner;
    }

    function updateUserProfile(string calldata name, string calldata email) external {
        _userProfiles[msg.sender] = UserProfile({ownerAddress: msg.sender, name: name, email: email});

        emit UserProfileUpdated(msg.sender, name, email);
    }

    function getUserProfile() external view returns (UserProfile memory) {
        return _userProfiles[msg.sender];
    }

    function createGroup(
        string calldata name,
        string calldata description,
        address[] calldata memberAddresses
    ) external {
        bytes32 groupId = keccak256(abi.encodePacked(msg.sender, address(this), name));
        require(_groups[groupId].groupId == 0, "group already exists");

        _groups[groupId] = Group({groupId: groupId, ownerAddress: msg.sender, name: name, description: description});
        _ownedGroups[msg.sender].push(_groups[groupId]);

        addGroupMembership(groupId, msg.sender);
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            addGroupMembership(groupId, memberAddresses[i]);
        }

        emit GroupCreated(groupId, msg.sender, name, description);
    }

    function getGroup(bytes32 groupId) external view returns (Group memory) {
        return _groups[groupId];
    }

    function listMembershipGroups() external view returns (Group[] memory) {
        return _membershipGroups[msg.sender];
    }

    function listGroupMemberships(bytes32 groupId) external view returns (Membership[] memory) {
        return _groupMemberships[groupId];
    }

    function addGroupMembership(bytes32 groupId, address memberAddress) internal {
        _membershipGroups[memberAddress].push(_groups[groupId]);
        _groupMemberships[groupId].push(Membership({memberAddress: memberAddress, name: "", balance: 0}));
    }
}
