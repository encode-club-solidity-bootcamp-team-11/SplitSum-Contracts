import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SplitSum } from "../typechain-types";

describe("SplitSum", () => {
  let deployer: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let contract: SplitSum;

  beforeEach(async () => {
    [deployer, ...accounts] = await ethers.getSigners();

    const contractFactory = await ethers.getContractFactory("SplitSum", deployer);
    contract = await contractFactory.deploy();
    await contract.deployed();
  });

  describe("Users", async () => {
    it("updates user profile", async () => {
      await contract.updateUserProfile("John Doe", "john@example.com");

      const userProfile = await contract.getUserProfile();
      expect(userProfile.name).to.eq("John Doe");
      expect(userProfile.email).to.eq("john@example.com");
    });

    it("emits an event after user profile updated", async () => {
      const account = accounts[0];

      await expect(contract.connect(account).updateUserProfile("John Doe", "john@example.com"))
        .to.emit(contract, "UserProfileUpdated")
        .withArgs(account.address, "John Doe", "john@example.com");
    });
  });
});
