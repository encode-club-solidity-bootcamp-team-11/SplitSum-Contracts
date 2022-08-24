import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { SplitSum } from "../typechain-types";

describe("SplitSum", function () {
  let deployer: SignerWithAddress;
  let account: SignerWithAddress;
  let contract: SplitSum;

  beforeEach(async () => {
    [deployer, account] = await ethers.getSigners();

    const contractFactory = await ethers.getContractFactory("SplitSum", deployer);
    contract = await contractFactory.deploy();
    await contract.deployed();
  });

  it("gets a simple test running", async function () {
    expect(await contract.settleUp()).to.equal("Settled up today & let's go again tomorrow :)");
  });
});
