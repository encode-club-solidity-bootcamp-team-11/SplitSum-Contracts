// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract SplitSum {
    event UserProfileUpdated(address indexed userAddress, string name, string email);
    event ContactAdded(address indexed userAddress, address indexed contactAddress, string name, string email);
    event GroupCreated(
        bytes32 indexed groupId,
        address indexed ownerAddress,
        string name,
        string description,
        uint256 createdAtTimestamp
    );
    event ExpenseCreated(
        bytes32 indexed expenseId,
        bytes32 indexed groupId,
        address indexed paidByUserAddress,
        uint256 amount,
        string description,
        uint256 createdAtTimestamp,
        address[] memberAddresses
    );

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
        uint256 createdAtTimestamp;
        address[] memberAddresses;
    }

    struct Membership {
        address memberAddress;
        int256 balance;
    }

    struct Expense {
        bytes32 expenseId;
        bytes32 groupId;
        address paidByUserAddress;
        uint256 amount; // 6 Decimals
        string description;
        uint256 createdAtTimestamp;
        address[] memberAddresses;
    }
    struct ExpenseMember {
        address memberAddress;
        uint256 amount; // 6 Decimals
    }

    address private _owner;

    mapping(address => User) private _userProfiles;
    mapping(address => User[]) private _userContacts;

    mapping(bytes32 => Group) private _groups;
    mapping(address => Group[]) private _membershipGroups;
    mapping(bytes32 => mapping(address => Membership)) private _groupMemberships;

    mapping(bytes32 => Expense) private _expenses;
    mapping(bytes32 => Expense[]) private _groupExpenses;
    mapping(bytes32 => mapping(address => ExpenseMember)) private _expenseMembers;

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

    /********************************************************************
     *   Users                                                          *
     ********************************************************************/

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

    /********************************************************************
     *   Groups                                                         *
     ********************************************************************/

    function createGroup(
        string calldata name,
        string calldata description,
        uint256 createdAtTimestamp,
        address[] calldata memberAddresses
    ) external {
        bytes32 groupId = keccak256(abi.encodePacked(msg.sender, address(this), name));
        require(_groups[groupId].groupId == 0, "group already exists");

        _groups[groupId] = Group({
            groupId: groupId,
            ownerAddress: msg.sender,
            name: name,
            description: description,
            createdAtTimestamp: createdAtTimestamp,
            memberAddresses: new address[](0)
        });

        _addGroupMembership(groupId, msg.sender);
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            _addGroupMembership(groupId, memberAddresses[i]);
        }

        emit GroupCreated(groupId, msg.sender, name, description, createdAtTimestamp);
    }

    function getGroup(bytes32 groupId) external view returns (Group memory) {
        return _groups[groupId];
    }

    function listMembershipGroups() external view returns (Group[] memory) {
        return _membershipGroups[msg.sender];
    }

    function listGroupMemberships(bytes32 groupId) external view returns (Membership[] memory) {
        Group memory group = _groups[groupId];
        address[] memory memberAddresses = group.memberAddresses;
        Membership[] memory memberships = new Membership[](memberAddresses.length);

        for (uint256 i = 0; i < memberAddresses.length; i++) {
            address memberAddress = memberAddresses[i];
            memberships[i] = _groupMemberships[groupId][memberAddress];
        }

        return memberships;
    }

    function addGroupMembership(bytes32 groupId, address memberAddress) external onlyGroupOwner(groupId) {
        _addGroupMembership(groupId, memberAddress);
    }

    function removeGroupMembership(bytes32 groupId, address memberAddress) external onlyGroupOwner(groupId) {
        require(
            _groupMemberships[groupId][memberAddress].balance == 0,
            "cannot remove member if they have non zero balance"
        );

        Group storage group = _groups[groupId];
        address[] storage memberAddresses = group.memberAddresses;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (memberAddresses[i] == memberAddress) {
                memberAddresses[i] = memberAddresses[memberAddresses.length - 1];
                memberAddresses.pop();
                delete _groupMemberships[groupId][memberAddress];

                break;
            }
        }

        Group[] storage membershipGroups = _membershipGroups[memberAddress];
        for (uint256 i = 0; i < membershipGroups.length; i++) {
            if (membershipGroups[i].groupId == groupId) {
                membershipGroups[i] = membershipGroups[membershipGroups.length - 1];
                membershipGroups.pop();
                break;
            }
        }
    }

    function _addGroupMembership(bytes32 groupId, address memberAddress) private {
        require(_groupMemberships[groupId][memberAddress].memberAddress == address(0), "member already exists");

        _groups[groupId].memberAddresses.push(memberAddress);
        _membershipGroups[memberAddress].push(_groups[groupId]);
        _groupMemberships[groupId][memberAddress] = Membership({memberAddress: memberAddress, balance: 0});
    }

    /********************************************************************
     *   Expenses                                                       *
     ********************************************************************/

    function createExpense(
        bytes32 groupId,
        uint256 amount,
        string calldata description,
        uint256 createdAtTimestamp,
        address[] calldata memberAddresses
    ) external {
        Expense memory expense = _createExpense(groupId, amount, description, createdAtTimestamp, memberAddresses);
        _splitExpenseAmongMembers(expense);
        _updateGroupMembershipBalances(expense);

        emit ExpenseCreated(
            expense.expenseId,
            groupId,
            msg.sender,
            amount,
            description,
            createdAtTimestamp,
            memberAddresses
        );
    }

    function getExpense(bytes32 expenseId) external view returns (Expense memory) {
        return _expenses[expenseId];
    }

    function listExpenseMembers(bytes32 expenseId) external view returns (ExpenseMember[] memory) {
        Expense memory expense = _expenses[expenseId];
        address[] memory memberAddresses = expense.memberAddresses;
        ExpenseMember[] memory expenseMembers = new ExpenseMember[](memberAddresses.length);

        for (uint256 i = 0; i < memberAddresses.length; i++) {
            address memberAddress = memberAddresses[i];
            expenseMembers[i] = _expenseMembers[expenseId][memberAddress];
        }

        return expenseMembers;
    }

    function _createExpense(
        bytes32 groupId,
        uint256 amount,
        string calldata description,
        uint256 createdAtTimestamp,
        address[] calldata memberAddresses
    ) private returns (Expense memory) {
        require(amount > 0, "amount must be greater than zero");
        _validateUserAddressInGroupMemberships(groupId, msg.sender);
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            _validateUserAddressInGroupMemberships(groupId, memberAddresses[i]);
        }

        bytes32 expenseId = keccak256(abi.encodePacked(msg.sender, groupId, amount, description, createdAtTimestamp));
        require(_expenses[expenseId].expenseId == 0, "expense already exists");

        _expenses[expenseId] = Expense({
            expenseId: expenseId,
            groupId: groupId,
            paidByUserAddress: msg.sender,
            amount: amount,
            description: description,
            createdAtTimestamp: createdAtTimestamp,
            memberAddresses: memberAddresses
        });
        _groupExpenses[groupId].push(_expenses[expenseId]);

        return _expenses[expenseId];
    }

    function _validateUserAddressInGroupMemberships(bytes32 groupId, address userAddress) private view {
        require(_groupMemberships[groupId][userAddress].memberAddress != address(0), "Not in the group members");
    }

    function _splitExpenseAmongMembers(Expense memory expense) private {
        uint256 expensePerMember = expense.amount / expense.memberAddresses.length;
        for (uint256 i = 0; i < expense.memberAddresses.length; i++) {
            _expenseMembers[expense.expenseId][expense.memberAddresses[i]] = ExpenseMember({
                memberAddress: expense.memberAddresses[i],
                amount: expensePerMember
            });
        }
    }

    function _updateGroupMembershipBalances(Expense memory expense) private {
        address[] memory memberAddresses = expense.memberAddresses;

        for (uint256 i = 0; i < memberAddresses.length; i++) {
            address memberAddress = memberAddresses[i];
            Membership storage membership = _groupMemberships[expense.groupId][memberAddress];
            uint256 memberExpenseAmount = _expenseMembers[expense.expenseId][memberAddress].amount;

            if (expense.paidByUserAddress == memberAddress) {
                membership.balance += int256(expense.amount - memberExpenseAmount);
            } else {
                membership.balance -= int256(memberExpenseAmount);
            }
        }
    }
}
