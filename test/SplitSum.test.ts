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
      expect(userProfile.ownerAddress).to.eq(account.address);
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

      const groupId = await createGroup(account, "Friend Hangouts", "group description");

      const group = await contract.getGroup(groupId);
      expect(group.groupId).to.eq(groupId);
      expect(group.ownerAddress).to.eq(account.address);
      expect(group.name).to.eq("Friend Hangouts");
      expect(group.description).to.eq("group description");
    });

    it("does not allow to create a duplicate group", async () => {
      const account = accounts[0];
      await createGroup(account, "existing group name", "group description");

      await expect(
        contract.connect(account).createGroup("existing group name", "group description", [])
      ).to.revertedWith("group already exists");
    });

    it("creates a new group with members", async () => {
      const account = accounts[0];
      const membersAddresses = [accounts[1].address, accounts[2].address];
      const groupId = await createGroup(account, "Friend Hangouts", "group description", membersAddresses);

      const memberships = await contract.listGroupMemberships(groupId);

      expect(memberships.length).to.eq(3);
      expect(memberships.map((a) => a.memberAddress)).to.have.members([
        account.address,
        membersAddresses[0],
        membersAddresses[1],
      ]);
      expect(memberships.map((a) => Number(a.balance))).to.have.members([0, 0, 0]);
    });

    it("list all groups that the user belongs to", async () => {
      const account = accounts[0];
      const theSameGroupAccount = accounts[1];
      const otherAccount = accounts[2];
      await createGroup(account, "My group", "group description");
      await createGroup(theSameGroupAccount, "My membership group", "group description", [account.address]);
      await createGroup(otherAccount, "Other group", "group description");

      const groups = await contract.connect(account).listMembershipGroups();

      expect(groups.length).to.eq(2);
      expect(groups[0].name).to.eq("My group");
      expect(groups[1].name).to.eq("My membership group");
    });
  });

  async function createGroup(
    owner: SignerWithAddress,
    name: string,
    description: string,
    membersAddresses: string[] = []
  ): Promise<string> {
    const txn = await contract.connect(owner).createGroup(name, description, membersAddresses);
    const txnReceipt = await txn.wait();
    const groupId = txnReceipt.events![0].args!.groupId;
    return groupId;
  }
});
