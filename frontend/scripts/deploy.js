const fs = require('fs');
const path = './src/landing_page/Shipment/contractAddress.json';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // 1. Deploy NirvanaToken first
  console.log("Deploying NirvanaToken...");
  const initialSupply = 1000000; // Define your initial token supply
  const NirvanaToken = await ethers.getContractFactory("NirvanaToken");
  const nirvanaToken = await NirvanaToken.deploy(initialSupply);
  await nirvanaToken.waitForDeployment();
  
  const tokenAddress = await nirvanaToken.target;
  console.log("NirvanaToken deployed to:", tokenAddress);
  
  // Add deployer to whitelist (since they'll need to transfer tokens)
  console.log("Adding deployer to whitelist...");
  await nirvanaToken.addToWhitelist(deployer.address);
  
  // 2. Deploy CardTransactionRegistry with token address and fee collector
  console.log("Deploying CardTransactionRegistry...");
  const CardTransactionRegistry = await ethers.getContractFactory("CardTransactionRegistry");
  const feeCollector = deployer.address; // Or specify another address for fee collection
  
  const cardTransactionRegistry = await CardTransactionRegistry.deploy(tokenAddress, feeCollector);
  await cardTransactionRegistry.waitForDeployment();
  
  const registryAddress = await cardTransactionRegistry.target;
  console.log("CardTransactionRegistry deployed to:", registryAddress);
  
  // 3. Add the registry contract to token whitelist so it can receive tokens
  console.log("Adding registry contract to whitelist...");
  await nirvanaToken.addToWhitelist(registryAddress);
  
  // 4. Save contract addresses for frontend
  const contractData = {
    address: registryAddress,
    tokenAddress: tokenAddress
  };
  
  fs.writeFileSync(path, JSON.stringify(contractData, null, 2));
  console.log("Contract addresses saved to", path);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });