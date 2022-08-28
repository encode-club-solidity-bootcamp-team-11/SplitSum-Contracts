import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const SplitSumContractFactory = await ethers.getContractFactory("SplitSum", deployer);
  const contract = await SplitSumContractFactory.deploy();
  await contract.deployed();

  console.log(`SplitSum is deployed to ${contract.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
