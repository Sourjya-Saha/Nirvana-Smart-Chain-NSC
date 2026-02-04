import React, { useState, useEffect } from "react";
import { ethers } from 'ethers';
import axios from 'axios';
import NirvanaTokenABI from "./NirvanaToken.json";
import './AdminPanel.css';
import TokenList from "./TokenList";
// Admin address that has exclusive access
const ADMIN_ADDRESS = "0xB2bA65deF35CB5c8769b2f802692D1E227318db7";

export default function AdminPanel() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tokenContract, setTokenContract] = useState(null);
  const [addressToWhitelist, setAddressToWhitelist] = useState("");
  const [addressToCheck, setAddressToCheck] = useState("");
  const [isAddressWhitelisted, setIsAddressWhitelisted] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenAmount, setTokenAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [balances, setBalances] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [networkInfo, setNetworkInfo] = useState({ name: "", chainId: "" });
  const [stats, setStats] = useState({
    totalWhitelisted: 0,
    totalSupply: "0",
    adminBalance: "0"
  });
  
  const tokenAddress = "0xa982307d3043922A887BaFF069C4F69C8c2fBcAe";
  
  // Initialize contract and load data on component mount
  useEffect(() => {
    const init = async () => {
      await checkWalletConnection();
    };
    
    init();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        handleAccountsChanged(accounts);
      });
      
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  // Add a separate useEffect to update stats and users when tokenContract changes
  useEffect(() => {
    if (tokenContract && isAdmin) {
      const updateData = async () => {
        try {
          await fetchNetworkInfo();
          await fetchStats(walletAddress);
          await fetchAllUsers();
        } catch (error) {
          console.error("Error updating data:", error);
        }
      };
      
      updateData();
    }
  }, [tokenContract, isAdmin]);


  const renderTokenListTab = () => (
    <div className="nsc-tokenlist-container">
      <TokenList />
    </div>
  );

  // Check if wallet is already connected
  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        // Get already connected accounts
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          const checksumAddress = ethers.getAddress(accounts[0]);
          setWalletAddress(checksumAddress);
          
          // Check if connected address is the admin
          if (checksumAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
            setIsAdmin(true);
            await loadContract(checksumAddress);
          } else {
            setIsAdmin(false);
            setErrorMessage("Access denied: You are not authorized to use this admin panel.");
          }
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error);
      }
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      // User disconnected their wallet
      setWalletAddress(null);
      setIsAdmin(false);
      setTokenContract(null);
    } else {
      const checksumAddress = ethers.getAddress(accounts[0]);
      setWalletAddress(checksumAddress);
      
      if (checksumAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
        setIsAdmin(true);
        await loadContract(checksumAddress);
      } else {
        setIsAdmin(false);
        setErrorMessage("Access denied: You are not authorized to use this admin panel.");
      }
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        setIsLoading(true);
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const checksumAddress = ethers.getAddress(accounts[0]);
        setWalletAddress(checksumAddress);
        
        // Check if connected address is the admin
        if (checksumAddress.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
          setIsAdmin(true);
          await loadContract(checksumAddress);
        } else {
          setIsAdmin(false);
          setErrorMessage("Access denied: You are not authorized to use this admin panel.");
        }
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        setErrorMessage("Failed to connect wallet: " + (error.message || "Unknown error"));
      } finally {
        setIsLoading(false);
      }
    } else {
      setErrorMessage("MetaMask is not installed. Please install MetaMask to use this admin panel.");
    }
  };

  const fetchNetworkInfo = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const networkName = network.name === 'homestead' ? 'Ethereum Mainnet' : network.name;
        setNetworkInfo({
          name: networkName.charAt(0).toUpperCase() + networkName.slice(1),
          chainId: network.chainId.toString()
        });
      } catch (error) {
        console.error("Error fetching network info:", error);
      }
    }
  };

  const fetchStats = async (address) => {
    if (!tokenContract) {
      console.error("Token contract not initialized");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Get total whitelisted count
      const whitelistedFilter = await tokenContract.filters.AddedToWhitelist();
      const whitelistedEvents = await tokenContract.queryFilter(whitelistedFilter);
      const removedFilter = await tokenContract.filters.RemovedFromWhitelist();
      const removedEvents = await tokenContract.queryFilter(removedFilter);
      
      // Calculate total after additions and removals
      const totalWhitelisted = whitelistedEvents.length - removedEvents.length;
      
      // Get total supply
      const totalSupply = await tokenContract.totalSupply();
      const formattedSupply = ethers.formatUnits(totalSupply, 18);
      
      // Get admin balance - explicit call for the ADMIN_ADDRESS
      const adminBalance = await tokenContract.balanceOf(ADMIN_ADDRESS);
      const formattedBalance = ethers.formatUnits(adminBalance, 18);
      
      setStats({
        totalWhitelisted,
        totalSupply: parseFloat(formattedSupply).toFixed(2),
        adminBalance: parseFloat(formattedBalance).toFixed(2)
      });
      
      console.log("Stats updated:", {
        totalWhitelisted,
        totalSupply: formattedSupply,
        adminBalance: formattedBalance
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setErrorMessage("Failed to fetch token stats: " + (error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const loadContract = async (address) => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(address);
        
        // Initialize the token contract
        const nirvanaToken = new ethers.Contract(
          tokenAddress,
          NirvanaTokenABI.abi,
          signer
        );
        
        console.log("Contract loaded:", nirvanaToken.target);
        setTokenContract(nirvanaToken);
        setErrorMessage("");
        return nirvanaToken;
      } catch (error) {
        console.error("Error loading contract:", error);
        setErrorMessage("Failed to load contract: " + (error.message || "Unknown error"));
        return null;
      }
    }
  };

  const addToWhitelist = async (addressToAdd = addressToWhitelist) => {
    if (!tokenContract || !isAdmin) return;
    if (!ethers.isAddress(addressToAdd)) {
      setErrorMessage("Invalid Ethereum address");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      
      const tx = await tokenContract.addToWhitelist(addressToAdd);
      
      // Show pending message
      setSuccessMessage(`Transaction pending: Adding ${addressToAdd} to whitelist...`);
      
      await tx.wait();
      
      setSuccessMessage(`Address ${addressToAdd.substring(0, 8)}...${addressToAdd.substring(36)} has been whitelisted successfully!`);
      setAddressToWhitelist("");
      
      // Refresh data after whitelist update
      await fetchStats(walletAddress);
      await fetchAllUsers();
    } catch (error) {
      console.error("Error adding to whitelist:", error);
      setErrorMessage("Failed to add to whitelist: " + (error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromWhitelist = async (address) => {
    if (!tokenContract || !isAdmin) return;

    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      
      const tx = await tokenContract.removeFromWhitelist(address);
      
      // Show pending message
      setSuccessMessage(`Transaction pending: Removing ${address.substring(0, 8)}...${address.substring(36)} from whitelist...`);
      
      await tx.wait();
      
      setSuccessMessage(`Address ${address.substring(0, 8)}...${address.substring(36)} has been removed from whitelist successfully!`);
      
      // Refresh data after whitelist update
      await fetchStats(walletAddress);
      await fetchAllUsers();
    } catch (error) {
      console.error("Error removing from whitelist:", error);
      setErrorMessage("Failed to remove from whitelist: " + (error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const checkWhitelistStatus = async () => {
    if (!tokenContract) return;
    if (!ethers.isAddress(addressToCheck)) {
      setErrorMessage("Invalid Ethereum address");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage("");
      
      const isWhitelisted = await tokenContract.isWhitelisted(addressToCheck);
      setIsAddressWhitelisted(isWhitelisted);
    } catch (error) {
      console.error("Error checking whitelist status:", error);
      setErrorMessage("Failed to check whitelist status: " + (error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    if (!isAdmin || !tokenContract) return;
    
    try {
      setIsLoading(true);
      const response = await axios.get('http://127.0.0.1:5000/api/get_all_users');
      
      if (response.status === 200) {
        const users = response.data.users;
        
        // Check whitelist status and token balance for each user
        const enhancedUsersPromises = users.map(async (user) => {
          let isWhitelisted = false;
          let balance = "0";
          
          if (ethers.isAddress(user.metamask_add)) {
            try {
              isWhitelisted = await tokenContract.isWhitelisted(user.metamask_add);
              const rawBalance = await tokenContract.balanceOf(user.metamask_add);
              balance = ethers.formatUnits(rawBalance, 18); // Assuming 18 decimals
            } catch (error) {
              console.error(`Error fetching data for ${user.metamask_add}:`, error);
            }
          }
          
          return { 
            ...user, 
            isWhitelisted,
            balance
          };
        });
        
        // Wait for all promises to resolve
        const enhancedUsers = await Promise.all(enhancedUsersPromises);
        setAllUsers(enhancedUsers);
        
        // Create a map of address to balance for quick access
        const balanceMap = {};
        enhancedUsers.forEach(user => {
          if (user.metamask_add) {
            balanceMap[user.metamask_add] = user.balance;
          }
        });
        setBalances(balanceMap);
      } else {
        setErrorMessage("Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setErrorMessage("Failed to fetch users: " + (error.response?.data?.error || error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  const sendTokens = async () => {
    if (!tokenContract || !isAdmin) return;
    if (!ethers.isAddress(recipientAddress)) {
      setErrorMessage("Invalid recipient address");
      return;
    }
    
    if (!tokenAmount || parseFloat(tokenAmount) <= 0) {
      setErrorMessage("Please enter a valid token amount");
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      
      // First check if recipient is whitelisted before attempting transfer
      const isWhitelisted = await tokenContract.isWhitelisted(recipientAddress);
      if (!isWhitelisted) {
        setErrorMessage("Transfer failed: Recipient address is not whitelisted. Please whitelist the address first.");
        return;
      }
      
      // Convert token amount to wei (assuming 18 decimals)
      const amountInWei = ethers.parseUnits(tokenAmount, 18);
      
      // Check if admin has sufficient balance
      const adminBalance = await tokenContract.balanceOf(walletAddress);
      
      // Fix: Use proper BigInt comparison instead of .lt method
      if (adminBalance < amountInWei) {
        setErrorMessage(`Insufficient balance. You have ${ethers.formatUnits(adminBalance, 18)} NSC tokens.`);
        return;
      }
      
      // Prepare transaction with higher gas limit to handle potential issues
      const tx = await tokenContract.transfer(recipientAddress, amountInWei, {
        gasLimit: ethers.toBigInt(300000) // Increase gas limit for better chances of transaction success
      });
      
      // Show pending message
      setSuccessMessage(`Transaction pending: Sending ${tokenAmount} NSC to ${recipientAddress.substring(0, 8)}...${recipientAddress.substring(36)}...`);
      
      await tx.wait();
      
      setSuccessMessage(`Successfully sent ${tokenAmount} NSC to ${recipientAddress.substring(0, 8)}...${recipientAddress.substring(36)}`);
      setTokenAmount("");
      setRecipientAddress("");
      
      // Refresh data after token transfer
      await fetchStats(walletAddress);
      await fetchAllUsers();
    } catch (error) {
      console.error("Error sending tokens:", error);
      
      // Improved error handling with specific error messages
      if (error.reason) {
        // Error with a specific reason
        if (error.reason.includes("non-whitelisted")) {
          setErrorMessage("Transfer failed: Recipient address is not whitelisted. Please whitelist the address first.");
        } else if (error.reason.includes("insufficient")) {
          setErrorMessage("Transfer failed: Insufficient balance for transfer.");
        } else {
          setErrorMessage(`Transfer failed: ${error.reason}`);
        }
      } else if (error.code) {
        // Handle RPC and other error codes
        switch (error.code) {
          case 'ACTION_REJECTED':
            setErrorMessage("Transaction rejected: You denied the transaction in your wallet.");
            break;
          case -32603:
            setErrorMessage("RPC error: Internal JSON-RPC error. This may be due to network congestion or node issues.");
            break;
          case 'INSUFFICIENT_FUNDS':
            setErrorMessage("Transaction failed: Insufficient funds for gas * price + value.");
            break;
          case 'UNPREDICTABLE_GAS_LIMIT':
            setErrorMessage("Transaction failed: Cannot estimate gas needed. The recipient may be a contract that reverts.");
            break;
          case 'UNKNOWN_ERROR':
            setErrorMessage("Unknown network error. Please check your network connection and try again.");
            break;
          default:
            // Handle other error codes
            setErrorMessage(`Transaction failed: ${error.message || error.code || "Unknown error"}`);
        }
      } else if (error.message) {
        // Parse error message for common issues
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes("non-whitelisted")) {
          setErrorMessage("Transfer failed: Recipient address is not whitelisted. Please whitelist the address first.");
        } else if (errorMsg.includes("insufficient funds")) {
          setErrorMessage("Transfer failed: Insufficient funds for gas + value.");
        } else if (errorMsg.includes("network")) {
          setErrorMessage("Network error: Please check your connection and try again.");
        } else if (errorMsg.includes("nonce")) {
          setErrorMessage("Transaction error: Nonce too high or too low. Try refreshing your page.");
        } else if (errorMsg.includes("timeout")) {
          setErrorMessage("Transaction timed out: Network may be congested. Please try again.");
        } else if (errorMsg.includes("user denied")) {
          setErrorMessage("Transaction cancelled: You rejected the transaction.");
        } else {
          // General error message with the actual error content for debugging
          setErrorMessage(`Transfer failed: ${error.message}`);
        }
      } else {
        // Fallback error message
        setErrorMessage("Failed to send tokens: An unknown error occurred. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    setWalletAddress(null);
    setIsAdmin(false);
    setTokenContract(null);
    setSuccessMessage("Wallet disconnected successfully.");
  };

  // Dashboard Components
  const renderDashboard = () => (
    
    <div className="nsc-dashboard-grid">
      <div className="nsc-stat-card nsc-total-whitelisted">
        <div className="nsc-stat-icon">
          <i className="fas fa-shield-alt"></i>
        </div>
        <div className="nsc-stat-content">
          <h3>Total Whitelisted</h3>
          <p className="nsc-stat-value">{stats.totalWhitelisted}</p>
          <p className="nsc-stat-label">Addresses</p>
        </div>
      </div>
      
      <div className="nsc-stat-card nsc-total-supply">
        <div className="nsc-stat-icon">
          <i className="fas fa-coins"></i>
        </div>
        <div className="nsc-stat-content">
          <h3>Total Supply</h3>
          <p className="nsc-stat-value">{stats.totalSupply}</p>
          <p className="nsc-stat-label">NSC Tokens</p>
        </div>
      </div>
      
      <div className="nsc-stat-card nsc-your-balance">
        <div className="nsc-stat-icon">
          <i className="fas fa-wallet"></i>
        </div>
        <div className="nsc-stat-content">
          <h3>Your Balance</h3>
          <p className="nsc-stat-value">{stats.adminBalance}</p>
          <p className="nsc-stat-label">NSC Tokens</p>
        </div>
      </div>
      
      <div className="nsc-stat-card nsc-network-info">
        <div className="nsc-stat-icon">
          <i className="fas fa-network-wired"></i>
        </div>
        <div className="nsc-stat-content">
          <h3>Network</h3>
          <p className="nsc-stat-value">{networkInfo.name}</p>
          <p className="nsc-stat-label">Chain ID: {networkInfo.chainId}</p>
        </div>
      </div>
      
      <div className="nsc-action-card nsc-whitelist-management">
        <h3>Quick Whitelist</h3>
        <div className="nsc-input-group">
          <input 
            type="text" 
            placeholder="Enter Ethereum address" 
            value={addressToWhitelist}
            onChange={(e) => setAddressToWhitelist(e.target.value)}
            className="nsc-eth-address-input"
          />
          <button 
            onClick={() => addToWhitelist()}
            disabled={isLoading || !addressToWhitelist}
            className="nsc-action-btn"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus-circle"></i>}
            Whitelist
          </button>
        </div>
      </div>
      
      <div className="nsc-action-card nsc-token-transfer">
        <h3>Quick Transfer</h3>
        <div className="nsc-input-group">
          <input 
            type="text" 
            placeholder="Recipient address" 
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className="nsc-recipient-input"
          />
        </div>
        <div className="nsc-input-group">
          <input 
            type="number" 
            placeholder="Amount of tokens" 
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
            step="0.01"
            min="0"
            className="nsc-amount-input"
          />
          <button 
            onClick={sendTokens}
            disabled={isLoading || !recipientAddress || !tokenAmount}
            className="nsc-action-btn"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
            Send
          </button>
        </div>
      </div>
    </div>
    
  );

  // Whitelist Management Components
  const renderWhitelistManagement = () => (
    
    <div className="nsc-whitelist-container">
      <div className="nsc-panel-section">
        <h2>Whitelist New Address</h2>
        <div className="nsc-input-group">
          <div className="nsc-input-wrapper">
            <i className="fas fa-user-shield nsc-input-icon"></i>
            <input 
              type="text" 
              placeholder="Enter Ethereum address to whitelist" 
              value={addressToWhitelist}
              onChange={(e) => setAddressToWhitelist(e.target.value)}
              className="nsc-whitelist-input"
            />
          </div>
          <button 
            onClick={() => addToWhitelist()}
            disabled={isLoading || !addressToWhitelist}
            className="nsc-primary-btn"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus-circle"></i>}
            Add to Whitelist
          </button>
        </div>
      </div>
      
      <div className="nsc-panel-section nsc-status-check-section">
        <h2>Check Whitelist Status</h2>
        <div className="nsc-input-group">
          <div className="nsc-input-wrapper">
            <i className="fas fa-search nsc-input-icon"></i>
            <input 
              type="text" 
              placeholder="Address to check" 
              value={addressToCheck}
              onChange={(e) => setAddressToCheck(e.target.value)}
              className="nsc-check-input"
            />
          </div>
          <button 
            onClick={checkWhitelistStatus}
            disabled={isLoading || !addressToCheck}
            className="nsc-secondary-btn"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check-circle"></i>}
            Check Status
          </button>
        </div>
        
        {isAddressWhitelisted !== null && (
          <div className={`nsc-status-result ${isAddressWhitelisted ? 'nsc-status-positive' : 'nsc-status-negative'}`}>
            <div className="nsc-status-header">
              <i className={`nsc-status-icon fas ${isAddressWhitelisted ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
              <h3>Whitelist Status</h3>
            </div>
            <p>Address: <span className="nsc-address">{addressToCheck}</span></p>
            <div className="nsc-status-badge">
              {isAddressWhitelisted ? "Whitelisted" : "Not Whitelisted"}
            </div>
          </div>
        )}
      </div>
    </div>
   
  );

  // Token Management Components
  const renderTokenManagement = () => (
   
    <div className="nsc-token-container">
      <div className="nsc-panel-section">
        <h2>Send NSC Tokens</h2>
        <div className="nsc-input-group">
          <div className="nsc-input-wrapper">
            <i className="fas fa-user nsc-input-icon"></i>
            <input 
              type="text" 
              placeholder="Recipient address" 
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="nsc-recipient-address-input"
            />
          </div>
        </div>
        <div className="nsc-input-group">
          <div className="nsc-input-wrapper">
            <i className="fas fa-coins nsc-input-icon"></i>
            <input 
              type="number" 
              placeholder="Amount of tokens" 
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              step="0.01"
              min="0"
              className="nsc-token-amount-input"
            />
          </div>
          <button 
            onClick={sendTokens}
            disabled={isLoading || !recipientAddress || !tokenAmount}
            className="nsc-primary-btn"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
            Send Tokens
          </button>
        </div>
      </div>
      
      <div className="nsc-panel-section">
        <h2>Token Information</h2>
        <div className="nsc-info-grid">
          <div className="nsc-info-item">
            <div className="nsc-info-label">Token Name</div>
            <div className="nsc-info-value">Nirvana Smart Coin</div>
          </div>
          <div className="nsc-info-item">
            <div className="nsc-info-label">Token Symbol</div>
            <div className="nsc-info-value">NSC</div>
          </div>
          <div className="nsc-info-item">
            <div className="nsc-info-label">Token Address</div>
            <div className="nsc-info-value nsc-address-value">
              {tokenAddress}
              <button className="nsc-copy-btn" onClick={() => {
                navigator.clipboard.writeText(tokenAddress);
                setSuccessMessage("Token address copied to clipboard!");
                setTimeout(() => setSuccessMessage(""), 3000);
              }}>
                <i className="fas fa-copy"></i>
              </button>
            </div>
          </div>
          <div className="nsc-info-item">
            <div className="nsc-info-label">Decimals</div>
            <div className="nsc-info-value">18</div>
          </div>
          <div className="nsc-info-item">
            <div className="nsc-info-label">Total Supply</div>
            <div className="nsc-info-value">{stats.totalSupply} NSC</div>
          </div>
          <div className="nsc-info-item">
            <div className="nsc-info-label">Admin Balance</div>
            <div className="nsc-info-value">{stats.adminBalance} NSC</div>
          </div>
        </div>
      </div>
    </div>
   
  );

  // Users Management Component
  const renderUsersManagement = () => (
    
    <div className="nsc-users-container">
      <div className="nsc-panel-section nsc-users-section">
        <div className="nsc-section-header">
          <h2>User Management</h2>
          <button className="nsc-refresh-btn" onClick={fetchAllUsers} disabled={isLoading || !tokenContract}>
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>}
            Refresh
          </button>
        </div>
        
        {isLoading ? (
          <div className="nsc-loading-container">
            <div className="nsc-loading-spinner"></div>
            <p>Loading user data...</p>
          </div>
        ) : (
          <div className="nsc-table-container">
            <table className="nsc-users-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Generated ID</th>
                  <th>MetaMask Address</th>
                  <th>NSC Balance</th>
                  <th>Whitelist Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.length > 0 ? (
                  allUsers.map((user) => (
                    <tr key={user.generated_unique_id || user.user_id}>
                      <td>{user.user_id}</td>
                      <td>{user.generated_unique_id}</td>
                      <td className="nsc-address-cell">
                        <div className="nsc-address-container">
                          <span className="nsc-address-text">{user.metamask_add}</span>
                          <button className="nsc-copy-btn" onClick={() => {
                            navigator.clipboard.writeText(user.metamask_add);
                            setSuccessMessage("Address copied to clipboard!");
                            setTimeout(() => setSuccessMessage(""), 3000);
                          }}>
                            <i className="fas fa-copy"></i>
                          </button>
                        </div>
                      </td>
                      <td className="nsc-balance-cell">{parseFloat(user.balance).toFixed(4)} NSC</td>
                      <td>
                        <span className={`nsc-status-pill ${user.isWhitelisted ? "nsc-status-active" : "nsc-status-inactive"}`}>
                          <i className={`fas ${user.isWhitelisted ? "fa-check-circle" : "fa-times-circle"}`}></i>
                          {user.isWhitelisted ? "Whitelisted" : "Not Whitelisted"}
                        </span>
                      </td>
                      <td className="nsc-actions-cell">
                        {user.isWhitelisted ? (
                          <button 
                            className="nsc-remove-btn" 
                            onClick={() => removeFromWhitelist(user.metamask_add)}
                            disabled={isLoading}
                          >
                            <i className="fas fa-user-minus"></i>
                            Unwhitelist
                          </button>
                        ) : (
                          <button 
                            className="nsc-add-btn" 
                            onClick={() => addToWhitelist(user.metamask_add)}
                            disabled={isLoading}
                          >
                            <i className="fas fa-user-plus"></i>
                            Whitelist
                          </button>
                        )}
                        <button 
                          className="nsc-send-btn"
                          onClick={() => {
                            setRecipientAddress(user.metamask_add);
                            setActiveTab("tokens");
                          }}
                        >
                          <i className="fas fa-paper-plane"></i>
                          Send
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="nsc-no-data">
                      <i className="fas fa-info-circle"></i>
                      No users found in the database
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    
  );

  return (
    <div className="admin-page">
    <div className="nsc-admin-dashboard">
      {/* Authentication overlay */}
      {!walletAddress && (
        <div className="nsc-auth-overlay">
          <div className="nsc-auth-card">
            <div className="nsc-auth-logo">
              <i className="fas fa-shield-alt"></i>
              <h1>NSC Token</h1>
            </div>
            <h2>Admin Dashboard</h2>
            <p>Connect your wallet to access the admin panel</p>
            <button 
              className="nsc-connect-wallet-btn" 
              onClick={connectWallet}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Connecting...
                </>
              ) : (
                <>
                  <i className="fas fa-wallet"></i>
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Access denied overlay */}
      {walletAddress && !isAdmin && (
        <div className="nsc-auth-overlay">
          <div className="nsc-auth-card nsc-error-card">
            <div className="nsc-auth-logo">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h2>Access Denied</h2>
            <p>You do not have permission to access this admin panel.</p>
            <p>The connected wallet <span className="nsc-admin-highlight">{walletAddress.substring(0, 8)}...{walletAddress.substring(36)}</span> is not authorized.</p>
            <button 
              className="nsc-disconnect-wallet-btn" 
              onClick={disconnectWallet}
            >
              <i className="fas fa-sign-out-alt"></i>
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
      
      {/* Main Dashboard */}
      {walletAddress && isAdmin && (
        <div className="nsc-admin-panel">
          {/* Header */}
          <header className="nsc-panel-header">
            <div className="nsc-logo-section">
              <i className="fas fa-shield-alt nsc-logo-icon"></i>
              <h1>NSC Token Admin Panel</h1>
            </div>
            <div className="nsc-header-actions">
              <div className="nsc-wallet-info">
                <i className="fas fa-wallet"></i>
                <span className="nsc-wallet-address">{walletAddress.substring(0, 8)}...{walletAddress.substring(36)}</span>
              </div>
              <button className="nsc-disconnect-btn" onClick={disconnectWallet}>
                <i className="fas fa-sign-out-alt"></i>
                Disconnect
              </button>
            </div>
          </header>
          
          {/* Navigation */}
          <nav className="nsc-panel-nav">
  <button 
    className={`nsc-nav-btn ${activeTab === "dashboard" ? "nsc-nav-active" : ""}`}
    onClick={() => setActiveTab("dashboard")}
  >
    <i className="fas fa-tachometer-alt"></i>
    Dashboard
  </button>
  <button 
    className={`nsc-nav-btn ${activeTab === "whitelist" ? "nsc-nav-active" : ""}`}
    onClick={() => setActiveTab("whitelist")}
  >
    <i className="fas fa-user-shield"></i>
    Whitelist
  </button>
  <button 
    className={`nsc-nav-btn ${activeTab === "tokens" ? "nsc-nav-active" : ""}`}
    onClick={() => setActiveTab("tokens")}
  >
    <i className="fas fa-coins"></i>
    Tokens
  </button>
  <button 
    className={`nsc-nav-btn ${activeTab === "users" ? "nsc-nav-active" : ""}`}
    onClick={() => setActiveTab("users")}
  >
    <i className="fas fa-users"></i>
    Users
  </button>
  {/* New token list tab */}
  <button 
    className={`nsc-nav-btn ${activeTab === "tokenlist" ? "nsc-nav-active" : ""}`}
    onClick={() => setActiveTab("tokenlist")}
  >
    <i className="fas fa-list-alt"></i>
    Token List
  </button>
</nav>
          
          {/* Main Content */}
          <main className="nsc-panel-content">
            {/* Notification Messages */}
            {errorMessage && (
              <div className="nsc-notification nsc-error-notification">
                <i className="fas fa-exclamation-circle"></i>
                <p className="nsc-notificationerror-p">{errorMessage}</p>
                <button onClick={() => setErrorMessage("")} className="nsc-close-notification">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
            
            {successMessage && (
              <div className="nsc-notification nsc-success-notification">
                <i className="fas fa-check-circle"></i>
                <p>{successMessage}</p>
                <button onClick={() => setSuccessMessage("")} className="nsc-close-notification">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
            
            {/* Tab Content */}
            <div className="nsc-tab-content">
  {activeTab === "dashboard" && renderDashboard()}
  {activeTab === "whitelist" && renderWhitelistManagement()}
  {activeTab === "tokens" && renderTokenManagement()}
  {activeTab === "users" && renderUsersManagement()}
  {activeTab === "tokenlist" && renderTokenListTab()}
</div>
          </main>
          
          {/* Footer */}
          <footer className="nsc-panel-footer">
            <p>NSC Token Admin Panel &copy; 2025</p>
            <div className="nsc-footer-info">
              <span className="nsc-token-address-display">
                Token: {tokenAddress.substring(0, 8)}...{tokenAddress.substring(36)}
              </span>
              <span className="nsc-network-display">
                <i className="fas fa-network-wired"></i>
                {networkInfo.name}
              </span>
            </div>
          </footer>
        </div>
      )}
    </div>
    </div>
  );
}