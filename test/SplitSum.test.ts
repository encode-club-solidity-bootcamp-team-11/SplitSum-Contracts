import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { SplitSum, USDCMockToken } from "../typechain-types";

describe("SplitSum", () => {
  let deployer: SignerWithAddress;
  let accounts: SignerWithAddress[];
  let contract: SplitSum;
  let USDCTokenContract: USDCMockToken;

  const USDC_DECIMALS = 6;

  beforeEach(async () => {
    [deployer, ...accounts] = await ethers.getSigners();

    USDCTokenContract = (await deployContract("USDCMockToken", "USDC Mock Token", "USDC")) as USDCMockToken;
    contract = (await deployContract("SplitSum", USDCTokenContract.address)) as SplitSum;
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
      expect(userProfile.userAddress).to.eq(account.address);
      expect(userProfile.name).to.eq("John Doe");
      expect(userProfile.email).to.eq("john@example.com");
    });

    it("emits an event after user profile updated", async () => {
      const account = accounts[0];

      await expect(contract.connect(account).updateUserProfile("John Doe", "john@example.com"))
        .to.emit(contract, "UserProfileUpdated")
        .withArgs(account.address, "John Doe", "john@example.com");
    });

    it("add a new contact", async () => {
      const account = accounts[0];
      const contact = accounts[1];

      await contract.connect(account).addContact(contact.address, "John Doe", "john@example.com");

      const contacts = await contract.connect(account).listContacts();

      expect(contacts.length).to.eq(1);
      expect(contacts[0].userAddress).to.eq(contact.address);
      expect(contacts[0].name).to.eq("John Doe");
    });
  });

  describe("Groups", async () => {
    it("creates a new group", async () => {
      const account = accounts[0];

      const groupId = await createGroup(account, "Friend Hangouts", "group description", getCurrentTime());

      const group = await contract.getGroup(groupId);
      expect(group.groupId).to.eq(groupId);
      expect(group.ownerAddress).to.eq(account.address);
      expect(group.name).to.eq("Friend Hangouts");
      expect(group.description).to.eq("group description");
    });

    it("does not allow to create a duplicate group", async () => {
      const account = accounts[0];
      await createGroup(account, "existing group name", "group description", getCurrentTime());

      await expect(
        contract.connect(account).createGroup("existing group name", "group description", getCurrentTime(), [])
      ).to.revertedWith("group already exists");
    });

    it("creates a new group with members", async () => {
      const account = accounts[0];
      const membersAddresses = [accounts[1].address, accounts[2].address];
      const groupId = await createGroup(
        account,
        "Friend Hangouts",
        "group description",
        getCurrentTime(),
        membersAddresses
      );

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
      await createGroup(account, "My group", "group description", getCurrentTime());
      await createGroup(theSameGroupAccount, "My membership group", "group description", getCurrentTime(), [
        account.address,
      ]);
      await createGroup(otherAccount, "Other group", "group description", getCurrentTime());

      const groups = await contract.connect(account).listMembershipGroups();

      expect(groups.length).to.eq(2);
      expect(groups[0].name).to.eq("My group");
      expect(groups[1].name).to.eq("My membership group");
    });

    it("add a new member into an existing group", async () => {
      const groupOwnerAccount = accounts[0];
      const membershipAccount = accounts[1];
      const otherAccount = accounts[2];
      const groupId = await createGroup(groupOwnerAccount, "My group", "group description", getCurrentTime());

      await expect(
        contract.connect(otherAccount).addGroupMembership(groupId, membershipAccount.address)
      ).to.revertedWith("Not a group owner");

      await contract.connect(groupOwnerAccount).addGroupMembership(groupId, membershipAccount.address);
      const memberships = await contract.listGroupMemberships(groupId);

      expect(memberships.length).to.eq(2);
      expect(memberships.map((a) => a.memberAddress)).to.have.members([
        groupOwnerAccount.address,
        membershipAccount.address,
      ]);
    });

    it("remove a member from an existing group", async () => {
      const groupOwnerAccount = accounts[0];
      const membershipAccount1 = accounts[1];
      const membershipAccount2 = accounts[2];
      const groupId = await createGroup(groupOwnerAccount, "My group", "group description", getCurrentTime(), [
        membershipAccount1.address,
        membershipAccount2.address,
      ]);

      await expect(
        contract.connect(membershipAccount1).removeGroupMembership(groupId, membershipAccount2.address)
      ).to.revertedWith("Not a group owner");

      await contract.connect(groupOwnerAccount).removeGroupMembership(groupId, membershipAccount2.address);
      const memberships = await contract.listGroupMemberships(groupId);

      expect(memberships.length).to.eq(2);
      expect(memberships.map((a) => a.memberAddress)).to.have.members([
        groupOwnerAccount.address,
        membershipAccount1.address,
      ]);

      const membershipGroups = await contract.connect(membershipAccount2).listMembershipGroups();
      expect(membershipGroups.length).to.eq(0);
    });
  });

  describe("Expenses", async () => {
    it("creates a group's expense", async () => {
      const [groupOwnerAccount, membershipAccount1, membershipAccount2, membershipAccount3] = accounts;
      const groupId = await createGroup(groupOwnerAccount, "My group", "group description", getCurrentTime(), [
        membershipAccount1.address,
        membershipAccount2.address,
        membershipAccount3.address,
      ]);

      const paidByUser = membershipAccount1;
      const sharedExpenseMembers = [paidByUser.address, membershipAccount2.address, membershipAccount3.address];
      const expenseAmount = toUSDC("150");
      const txn = await contract
        .connect(paidByUser)
        .createExpense(groupId, expenseAmount, "yesterday hangout", getCurrentTime(), sharedExpenseMembers);
      const txnReceipt = await txn.wait();
      const expenseId = txnReceipt.events![0].args!.expenseId;

      const expense = await contract.getExpense(expenseId);
      expect(expense.groupId).to.eq(groupId);
      expect(expense.amount).to.eq(expenseAmount);
      expect(expense.description).to.eq("yesterday hangout");
      expect(expense.memberAddresses).to.eql(sharedExpenseMembers);

      const expenseMembers = await contract.listExpenseMembers(expenseId);
      expect(expenseMembers.map((a) => a.memberAddress)).to.have.members(sharedExpenseMembers);
      expect(expenseMembers.map((a) => ethers.utils.formatUnits(a.amount, USDC_DECIMALS))).to.have.members([
        "50.0",
        "50.0",
        "50.0",
      ]);
    });

    it("lists all group's memberships with their balances", async () => {
      const [groupOwnerAccount, membershipAccount1, membershipAccount2, membershipAccount3] = accounts;
      const groupId = await createGroup(groupOwnerAccount, "My group", "group description", getCurrentTime(), [
        membershipAccount1.address,
        membershipAccount2.address,
        membershipAccount3.address,
      ]);

      await contract
        .connect(membershipAccount1)
        .createExpense(groupId, toUSDC("150"), "yesterday hangout", getCurrentTime(), [
          membershipAccount1.address,
          membershipAccount2.address,
          membershipAccount3.address,
        ]);
      await contract
        .connect(groupOwnerAccount)
        .createExpense(groupId, toUSDC("300"), "Bob's party", getCurrentTime(), [
          groupOwnerAccount.address,
          membershipAccount1.address,
          membershipAccount2.address,
        ]);

      const memberships = await contract.listGroupMemberships(groupId);
      expect(memberships.length).to.eq(4);
      const getAccountBalance = (account: any) => memberships.find((m) => m.memberAddress == account.address)?.balance;
      expect(getAccountBalance(groupOwnerAccount)).to.eq(toUSDC("200"));
      expect(getAccountBalance(membershipAccount1)).to.eq(0);
      expect(getAccountBalance(membershipAccount2)).to.eq(toUSDC("-150"));
      expect(getAccountBalance(membershipAccount3)).to.eq(toUSDC("-50"));
    });

    it("allows only group's members to create expenses", async () => {
      const [groupOwnerAccount, membershipAccount1, otherAccount] = accounts;
      const groupId = await createGroup(groupOwnerAccount, "My group", "group description", getCurrentTime(), [
        membershipAccount1.address,
      ]);

      const paidByUser = groupOwnerAccount;
      const sharedExpenseMembers = [paidByUser.address, membershipAccount1.address];
      await expect(
        contract
          .connect(otherAccount)
          .createExpense(groupId, toUSDC("150"), "yesterday hangout", getCurrentTime(), sharedExpenseMembers)
      ).to.revertedWith("Not in the group members");
    });
  });

  describe("Settlement", async () => {
    it("settles up the amount that the user owed within the group", async () => {
      const [groupOwnerAccount, membershipAccount1, membershipAccount2] = accounts;
      const groupId = await createGroup(groupOwnerAccount, "My group", "group description", getCurrentTime(), [
        membershipAccount1.address,
        membershipAccount2.address,
      ]);

      const sharedExpenseMembers = [groupOwnerAccount.address, membershipAccount1.address, membershipAccount2.address];
      await contract
        .connect(groupOwnerAccount)
        .createExpense(groupId, toUSDC("150"), "yesterday hangout", getCurrentTime(), sharedExpenseMembers);

      await USDCTokenContract.mint(membershipAccount1.address, toUSDC("50"));
      await USDCTokenContract.connect(membershipAccount1).approve(contract.address, toUSDC("50"));
      const txn = await contract.connect(membershipAccount1).settleUp(groupId, toUSDC("50"), getCurrentTime());
      const txnReceipt = await txn.wait();

      const memberships = await contract.listGroupMemberships(groupId);
      const getAccountBalance = (account: any) => memberships.find((m) => m.memberAddress == account.address)?.balance;
      expect(getAccountBalance(groupOwnerAccount)).to.eq(toUSDC("50"));
      expect(getAccountBalance(membershipAccount1)).to.eq(0);
      expect(getAccountBalance(membershipAccount2)).to.eq(toUSDC("-50"));

      // TODO: Not sure why we could query events from the network
      // const settlementId = txnReceipt.events![0].args!.settlementId;
      // const settlementMembers = await contract.listSettlementMembers(settlementId);
      // expect(settlementMembers.length).to.eq(1);
      // expect(settlementMembers[0].memberAddress).to.eq(groupOwnerAccount.address);
      // expect(settlementMembers[0].amount).to.eq(toUSDC("50"));
    });
  });

  async function deployContract(contractName: string, ...args: any[]): Promise<Contract> {
    const contractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await contractFactory.deploy(...args);
    await contract.deployed();

    return contract;
  }

  function toUSDC(amount: string): BigNumber {
    return ethers.utils.parseUnits(amount, USDC_DECIMALS);
  }

  async function createGroup(
    owner: SignerWithAddress,
    name: string,
    description: string,
    createdAtTimestamp: number,
    membersAddresses: string[] = []
  ): Promise<string> {
    const txn = await contract.connect(owner).createGroup(name, description, createdAtTimestamp, membersAddresses);
    const txnReceipt = await txn.wait();
    const groupId = txnReceipt.events![0].args!.groupId;
    return groupId;
  }

  function getCurrentTime(): number {
    return Math.floor(Date.now() / 1000);
  }
});
