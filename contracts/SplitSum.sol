// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract SplitSum {
    event UserProfileUpdated(address indexed user, string name, string email);

    struct UserProfile {
        string name;
        string email;
    }

    mapping(address => UserProfile) private _userProfiles;

    function updateUserProfile(string calldata name, string calldata email) external {
        UserProfile storage userProfile = _userProfiles[msg.sender];
        userProfile.name = name;
        userProfile.email = email;

        emit UserProfileUpdated(msg.sender, name, email);
    }

    function getUserProfile() external view returns (UserProfile memory) {
        return _userProfiles[msg.sender];
    }
}
