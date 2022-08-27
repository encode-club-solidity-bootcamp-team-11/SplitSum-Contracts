// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract SplitSum {
    event UserProfileUpdated(address indexed userAddress, string name, string email);
    event ContactAdded(address indexed userAddress, address indexed contactAddress, string name, string email);
    event GroupCreated(bytes32 indexed groupId, address indexed ownerAddress, string name, string description);

    struct User {
        address userAddress;
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
        int256 balance;
    }

    address private _owner;

    mapping(address => User) private _userProfiles;
    mapping(address => User[]) private _userContacts;

    mapping(bytes32 => Group) private _groups;
    mapping(address => Group[]) private _ownedGroups;
    mapping(address => Group[]) private _membershipGroups;
    mapping(bytes32 => Membership[]) private _groupMemberships;

    modifier onlyGroupOwner(bytes32 groupId) {
        require(_groups[groupId].ownerAddress == msg.sender, "Not a group owner");
        _;
    }

    constructor() {
        _owner = msg.sender;
    }

    function owner() external view returns (address) {
        return _owner;
    }

    function updateUserProfile(string calldata name, string calldata email) external {
        _userProfiles[msg.sender] = User({userAddress: msg.sender, name: name, email: email});

        emit UserProfileUpdated(msg.sender, name, email);
    }

    function getUserProfile() external view returns (User memory) {
        return _userProfiles[msg.sender];
    }

    function addContact(
        address contactAddress,
        string calldata name,
        string calldata email
    ) external {
        _userContacts[msg.sender].push(User({userAddress: contactAddress, name: name, email: email}));

        emit ContactAdded(msg.sender, contactAddress, name, email);
    }

    function listContacts() external view returns (User[] memory) {
        return _userContacts[msg.sender];
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

        _addGroupMembership(groupId, msg.sender);
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            _addGroupMembership(groupId, memberAddresses[i]);
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

    function addGroupMembership(bytes32 groupId, address memberAddress) external onlyGroupOwner(groupId) {
        _addGroupMembership(groupId, memberAddress);
    }

    function removeGroupMembership(bytes32 groupId, address memberAddress) external onlyGroupOwner(groupId) {
        Membership[] storage groupMemberships = _groupMemberships[groupId];
        for (uint256 i = 0; i < groupMemberships.length; i++) {
            if (groupMemberships[i].memberAddress == memberAddress) {
                groupMemberships[i] = groupMemberships[groupMemberships.length - 1];
                groupMemberships.pop();
                break;
            }
        }
        delete _membershipGroups[memberAddress];
    }

    function _addGroupMembership(bytes32 groupId, address memberAddress) internal {
        _membershipGroups[memberAddress].push(_groups[groupId]);
        _groupMemberships[groupId].push(Membership({memberAddress: memberAddress, balance: 0}));
    }
}
