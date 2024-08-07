import { Wallet, Provider } from "zksync-ethers";
import * as ethers from "ethers";

// load env file
import dotenv from "dotenv";
import {ConnectionInfo} from "@ethersproject/web";
import {Address} from "zksync-ethers/src/types";
dotenv.config();

// HTTP RPC endpoints
const L1_RPC_ENDPOINT = process.env.L1_RPC_ENDPOINT || ""; // or an RPC endpoint from Infura/Chainstack/QuickNode/etc.
const L2_RPC_ENDPOINT = process.env.L2_RPC_ENDPOINT || "https://testnet.era.zksync.dev"; // or the zkSync Era mainnet

// Wallet
const WALLET_PRIV_KEY = process.env.WALLET_PRIV_KEY || "";

if (!WALLET_PRIV_KEY) {
  throw new Error("Wallet private key is not configured in env file");
}

if (!L1_RPC_ENDPOINT) {
  throw new Error("Missing L1 RPC endpoint. Check chainlist.org or an RPC node provider");
}

const WITHDRAW_TX_HASH = process.env.WITHDRAW_TX_HASH || "";
if (!WITHDRAW_TX_HASH) {
  throw new Error("Withdraw tx hash is not configured in env file");
}
console.log(`Withdraw tx hash: ${WITHDRAW_TX_HASH}`);

class ZkLinkProvider extends Provider {

  constructor(contractAddresses: {
    mainContract?: Address;
    erc20BridgeL1?: Address;
    erc20BridgeL2?: Address;
    wethBridgeL1?: Address;
    wethBridgeL2?: Address;
  }, url?: ConnectionInfo | string, network?: ethers.providers.Networkish) {
    super(url, network);
    this.contractAddresses = contractAddresses;
  }
}

async function main() {
  console.log(`Running script to withdraw ETH to L1`);

  // Initialize the wallet.
  const onSecondaryChain = Boolean(process.env.SECONDARY_CHAIN) || false;
  const l1provider = new Provider(L1_RPC_ENDPOINT);
  let l2provider: Provider;
  if (onSecondaryChain) {
    const mainContract = process.env.SECONDARY_CHAIN_MAIN_CONTRACT_ADDRESS || "";
    const erc20BridgeL1 = process.env.SECONDARY_CHAIN_L1ERC20_CONTRACT_ADDRESS || "";
    const erc20BridgeL2 = process.env.SECONDARY_CHAIN_L2ERC20_CONTRACT_ADDRESS || "";
    const contractAddresses = {
      mainContract,
      erc20BridgeL1,
      erc20BridgeL2,
      wethBridgeL1: erc20BridgeL1,
      wethBridgeL2: erc20BridgeL2,
    };
    l2provider = new ZkLinkProvider(contractAddresses, L2_RPC_ENDPOINT);
  } else {
    l2provider = new Provider(L2_RPC_ENDPOINT);
  }
  const wallet = new Wallet(WALLET_PRIV_KEY, l2provider, l1provider);

  console.log(`L1 Balance is ${await wallet.getBalanceL1()}`);
  console.log(`L2 Balance is ${await wallet.getBalance()}`);

  const mainContract = await wallet.getMainContract();
  console.log(`Main contract address: ${mainContract.address}`);

  const l1BridgeContracts = await wallet.getL1BridgeContracts();
  console.log(`L1WETH address: ${l1BridgeContracts.weth.address}`);
  console.log(`L1ERC20 address: ${l1BridgeContracts.erc20.address}`);

  const finalizeWithdrawParams = await wallet.finalizeWithdrawalParams(WITHDRAW_TX_HASH);
  console.log(`Finalize withdraw params: ${JSON.stringify(finalizeWithdrawParams)}`);
  try {
    // withdraw ETH to L1
    const withdrawHandle = await wallet.finalizeWithdrawal(WITHDRAW_TX_HASH);
    console.log(`Withdraw transaction sent ${withdrawHandle.hash}`);
  } catch (error: any) {
    console.error(`Error withdrawing: ${error.message}`);
    process.exitCode = 1;
  }
}

main()
  .then()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

