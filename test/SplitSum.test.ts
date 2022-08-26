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

  describe("Deployment", async () => {
    it("sets the contract's owner", async () => {
      expect(await contract.owner()).to.eq(deployer.address);
    });
  });

  describe("Users", async () => {
    it("updates user profile", async () => {
      const account = accounts[0];
      await contract.connect(account).updateUserProfile("John Doe", "john@example.com");

      const userProfile = await contract.connect(account).getUserProfile();
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

  describe("Groups", async () => {
    it("creates a new group", async () => {
      const account = accounts[0];

      const txn = await contract.connect(account).createGroup("Friend Hangouts", "group description");
      const txnReceipt = await txn.wait();

      const groupId = txnReceipt.events![0].args!.groupId;
      const group = await contract.getGroup(groupId);
      expect(group.groupId).to.eq(groupId);
      expect(group.ownerAddress).to.eq(account.address);
      expect(group.name).to.eq("Friend Hangouts");
      expect(group.description).to.eq("group description");
    });

    it("list all groups that the user belongs to", async () => {
      const account = accounts[0];
      const otherAccount = accounts[1];

      await contract.connect(account).createGroup("My group", "group description");
      await contract.connect(otherAccount).createGroup("Other group", "group description");

      const groups = await contract.connect(account).listMembershipGroups();
      expect(groups.length).to.eq(1);
      expect(groups[0].name).to.eq("My group");
    });
  });
});
