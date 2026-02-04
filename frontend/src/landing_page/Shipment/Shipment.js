import React, { useState, useEffect } from "react";
import { ethers } from 'ethers'; // ethers v6
import axios from 'axios';
import CardTransactionRegistry from "./CardTransactionRegistry.json"; // Import your ABI JSON
import NirvanaTokenABI from "./NirvanaToken.json"; // Import the token ABI
import SideManu from "../SideManu";
import './Shipment.css'; // Import the CSS file

import contractConfig from './contractAddress.json';
import TokenInfoSection from "./TokenInfoSection";

export default function Dashboard() {
  
  const [walletAddress, setWalletAddress] = useState(null);// for storing connected wallet addresss
  const [contract, setContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [tokenBalance, setTokenBalance] = useState("0");
  const [isAddressWhitelisted, setIsAddressWhitelisted] = useState(false);
  const [transactionFee, setTransactionFee] = useState("0");
  const [allowance, setAllowance] = useState("0");
  const [formInput, setFormInput] = useState({
    cardId: "",
    receiverAddressW: "",
    receiverAddressR: "",
    date: "",
    receiverAddressM: "",
  });
  const [errorMessage, setErrorMessage] = useState(""); // For showing errors related to transactions
  const [hashMismatchError, setHashMismatchError] = useState(""); // For hash mismatch
  const [allTransactions, setAllTransactions] = useState([]); // State to store all transactions
  const [isTransactionSuccess, setIsTransactionSuccess] = useState(false); 
  const [currentPage, setCurrentPage] = useState(1);
  const [isQrScanned, setIsQrScanned] = useState(false);
  
  // Pagination calculation
  const itemsPerPage = 5;
  const pages = Math.ceil(allTransactions.length / itemsPerPage);
  const indexOfLastTransaction = currentPage * itemsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - itemsPerPage;
  const currentTransactions = allTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);

  const getPaginationGroup = () => {
    const start = Math.floor((currentPage - 1) / 5) * 5;
    return new Array(Math.min(5, pages - start)).fill().map((_, idx) => start + idx + 1);
  };
  
  const contractAddress = contractConfig.address; // Your registry contract address
  const tokenAddress = contractConfig.tokenAddress; // Your token contract address

  useEffect(() => {
    // Block common developer tools shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U)
    const handleKeydown = (e) => {
      if (
        e.key === 'F12' ||  // F12 key for developer tools
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||  // Ctrl+Shift+I for dev tools
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||  // Ctrl+Shift+J for console
        (e.ctrlKey && e.key === 'U')  // Ctrl+U for viewing page source
      ) {
        e.preventDefault();  // Prevent default behavior
        alert('Developer Tools are disabled');
      }
    };

    // Disable right-click context menu
    const disableRightClick = (e) => {
      e.preventDefault();  // Prevent right-click menu from appearing
    };

    // Add event listeners for keydown and right-click events
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('contextmenu', disableRightClick);

    // Cleanup event listeners on component unmount
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('contextmenu', disableRightClick);
    };
  }, []); 

  useEffect(() => {
    const init = async () => {
      await loadContract();
      setErrorMessage("");
      setHashMismatchError("");
    };
    init();
  }, []);

  useEffect(() => {
    if (contract && walletAddress) {
      fetchAllTransactions();
      fetchTokenDetails();
      setErrorMessage(""); // Call this only after the contract and wallet address are set
      setHashMismatchError("");  
    }
  }, [contract, walletAddress, tokenContract]);

  const loadContract = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const checksummedAddress = ethers.getAddress(accounts[0]);
        setWalletAddress(checksummedAddress); 
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(checksummedAddress);
        
        // Initialize the registry contract
        const cardTransactionRegistry = new ethers.Contract(
          contractAddress,
          CardTransactionRegistry.abi,
          signer
        );
        setContract(cardTransactionRegistry);
        
        // Get token address from the registry contract
        const tokenContractAddress = await cardTransactionRegistry.getTokenAddress();
        
        // Initialize the token contract
        const nirvanaToken = new ethers.Contract(
          tokenContractAddress,
          NirvanaTokenABI.abi,
          signer
        );
        setTokenContract(nirvanaToken);
        
        setErrorMessage("");
        setHashMismatchError("");
      } catch (error) {
        console.error("Error loading contracts:", error);
        setErrorMessage("Failed to load contracts: " + (error.message || "Unknown error"));
      }
    } else {
      setErrorMessage("MetaMask is not installed or not accessible");
    }
  };

  const fetchTokenDetails = async () => {
    if (tokenContract && walletAddress && contract) {
      try {
        // Get token balance
        const balance = await tokenContract.balanceOf(walletAddress);
        setTokenBalance(ethers.formatEther(balance));
        
        // Check if address is whitelisted
        const isWhitelisted = await tokenContract.isWhitelisted(walletAddress);
        setIsAddressWhitelisted(isWhitelisted);
        
        // Get transaction fee
        const fee = await contract.transactionFee();
        setTransactionFee(ethers.formatEther(fee));
        
        // Get token allowance for the contract
        const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        setAllowance(ethers.formatEther(currentAllowance));
      } catch (error) {
        console.error("Error fetching token details:", error);
        setErrorMessage("Failed to fetch token details: " + (error.message || "Unknown error"));
      }
    }
  };

  const approveTokenSpending = async () => {
    if (tokenContract) {
      try {
        const decimals = await tokenContract.decimals();
        const approvalAmount = ethers.parseUnits("1000", decimals); // Approve 1000 tokens
        
        // Simpler transaction approach
        const transaction = await tokenContract.approve(
          contractAddress, 
          approvalAmount
          // Let the wallet estimate gas automatically
        );
        
        console.log("Approval transaction sent:", transaction.hash);
        await transaction.wait();
        
        // Update allowance after approval
        const newAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        setAllowance(ethers.formatEther(newAllowance));
        
        setErrorMessage("");
        setHashMismatchError("");
        alert("Token spending approved successfully!");
      } catch (error) {
        console.error("Error approving token spending:", error);
        setErrorMessage("Failed to approve token spending: " + (error.message || "Unknown error"));
      }
    }
  };

  const handleTransactionError = (error) => {
    // Reset both errors first
    setHashMismatchError("");
    setErrorMessage("");
  
    if (error.message && error.message.includes("Hash mismatch")) {
      const hashData = error.reason.slice(15);
      
      // Immediately check conditions and set appropriate error message
      if (hashData.slice(0, 42) !== walletAddress) {
        setErrorMessage("manufacture wallet address mismatch");
      } 
       if (hashData.slice(42, 84) !== formInput.receiverAddressW) {
        setErrorMessage("Wholesaler wallet address mismatch");
      }
       if (hashData.slice(84, 126) !== formInput.receiverAddressR) {
        setErrorMessage("Retailer wallet address mismatch");
      } 
       if (hashData.slice(126, 136) !== formInput.date) {
        setErrorMessage("Date mismatch");
      }
      
      setHashMismatchError(hashData);
      console.log(errorMessage);
    } else if (error.message && error.message.includes("ERC20: transfer to non-whitelisted address")) {
      setErrorMessage("Cannot transfer to a non-whitelisted address!");
    } else if (error.message && error.message.includes("Fee payment failed")) {
      setErrorMessage("Transaction fee payment failed. Please check your token balance and allowance.");
    } else {
      setErrorMessage(error.reason || error.message || "An unknown error occurred");
      console.log(errorMessage);
    }
  };

  const registerCardTransaction = async () => {
    if (contract && tokenContract) {
      const { cardId, receiverAddressW, receiverAddressR, date, receiverAddressM } = formInput;

      // Check retailer address is whitelisted if it's provided
      if (receiverAddressR && receiverAddressR.length === 42) {
        try {
          const isRetailerWhitelisted = await tokenContract.isWhitelisted(receiverAddressR);
          if (!isRetailerWhitelisted) {
            setErrorMessage("Retailer address is not whitelisted!");
            return;
          }
        } catch (error) {
          setErrorMessage("Failed to verify retailer whitelist status");
          return;
        }
      }

      // Check wholesaler address is whitelisted if it's provided
      if (receiverAddressW && receiverAddressW.length === 42) {
        try {
          const isWholesalerWhitelisted = await tokenContract.isWhitelisted(receiverAddressW);
          if (!isWholesalerWhitelisted) {
            setErrorMessage("Wholesaler address is not whitelisted!");
            return;
          }
        } catch (error) {
          setErrorMessage("Failed to verify wholesaler whitelist status");
          return;
        }
      }

      const mergedReceiverAddressW = receiverAddressW || "                                          ";
      const mergedReceiverAddressR = receiverAddressR || "                                          ";
      
      const merged = walletAddress + mergedReceiverAddressW + mergedReceiverAddressR + date + cardId;
      try {
        // Check if we have enough allowance
        const fee = await contract.transactionFee();
        const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        
        if (currentAllowance < fee) {
          setErrorMessage("Insufficient token allowance. Please approve tokens first.");
          return;
        }
        
        const transaction = await contract.registerCardTransaction(merged);
        await transaction.wait();
        
        // Add API call after blockchain transaction is successful
        const apiResponse = await axios.post('http://127.0.0.1:5000/add_transaction', {
          cart_id: cardId,
          manu_add: receiverAddressM,
          whole_add: receiverAddressW,
          ret_add: receiverAddressR
        });

        // Check if API call was successful
        if (apiResponse.status === 200) {
          setFormInput({ cardId: "", receiverAddressW: "", receiverAddressR: "", date: "", receiverAddressM: "" });
          fetchAllTransactions();
          fetchTokenDetails(); // Update token details after transaction
          setErrorMessage(""); // Clear any previous error messages
          setHashMismatchError("");
          setIsTransactionSuccess(true);
          console.log("Transaction registered successfully in both blockchain and database");
        } else {
          throw new Error("Failed to add transaction to database");
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error || error.reason || error.message || "An unknown error occurred";
        handleTransactionError(error);
        setIsTransactionSuccess(false);
        console.error("Error registering transaction:", errorMsg);
      }
    }
  };

  // Function to fetch transactions by multiple fields for wholesaler
  const fetchCardTransactionWR = async () => {
    if (contract) {
      const { cardId, receiverAddressW, receiverAddressR, date, receiverAddressM } = formInput;
      const merged = walletAddress + receiverAddressW + "                                          " + date + cardId;
      
      try {
        // Check if we have enough allowance
        const fee = await contract.transactionFee();
        const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        
        if (currentAllowance < fee) {
          setErrorMessage("Insufficient token allowance. Please approve tokens first.");
          return;
        }
        
        const transactionData = await contract.searchCardTransactionWR(merged);
        await transactionData.wait(); // Wait for the transaction to be mined
        console.log(transactionData);
        fetchAllTransactions(); // Refresh the all transactions list after registering
        fetchTokenDetails(); // Update token details after transaction
        setErrorMessage(""); // Clear any previous error messages
        setHashMismatchError("");
      } catch (error) {
        handleTransactionError(error);
      }
    }
  };

  const registerCardTransactionW = async () => {
    if (contract) {
      const { cardId, receiverAddressW, receiverAddressR, date, receiverAddressM } = formInput;
      
      // Check retailer address is whitelisted if it's provided
      if (receiverAddressR && receiverAddressR.length === 42) {
        try {
          const isRetailerWhitelisted = await tokenContract.isWhitelisted(receiverAddressR);
          if (!isRetailerWhitelisted) {
            setErrorMessage("Retailer address is not whitelisted!");
            return;
          }
        } catch (error) {
          setErrorMessage("Failed to verify retailer whitelist status");
          return;
        }
      }
      
      try {
        // Check if we have enough allowance
        const fee = await contract.transactionFee();
        const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        
        if (currentAllowance < fee) {
          setErrorMessage("Insufficient token allowance. Please approve tokens first.");
          return;
        }
        
        const merged = "                                          " + receiverAddressW + receiverAddressR + date + cardId;
      
        const transaction = await contract.registerCardTransactionW(merged);
        await transaction.wait(); 
        setFormInput({ cardId: "", receiverAddressW: "", receiverAddressR: "", date: "", receiverAddressM: "" });
        fetchAllTransactions(); 
        fetchTokenDetails(); // Update token details after transaction
        setErrorMessage(""); // Clear any previous error messages
        setHashMismatchError("");
      } catch (error) {
        handleTransactionError(error);
      }
    }
  };
  
  // Function to fetch transactions by multiple fields for wholesaler
  const fetchCardTransactionR = async () => {
    if (contract) {
      const { cardId, receiverAddressW, receiverAddressR, date, receiverAddressM } = formInput;
      const mergedReceiverAddressW = receiverAddressW || "                                          ";
      const mergedReceiverAddressM = receiverAddressM || "                                          ";
      
      const merged = mergedReceiverAddressM + mergedReceiverAddressW + receiverAddressR + date + cardId;
      
      try {
        // Check if we have enough allowance
        const fee = await contract.transactionFee();
        const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        
        if (currentAllowance < fee) {
          setErrorMessage("Insufficient token allowance. Please approve tokens first.");
          return;
        }
        
        const transactionData = await contract.searchCardTransactionR(merged);
        await transactionData.wait(); // Wait for the transaction to be mined
        console.log(transactionData);
        fetchAllTransactions(); // Refresh the all transactions list after registering
        fetchTokenDetails(); // Update token details after transaction
        setErrorMessage(""); // Clear any previous error messages
        setHashMismatchError("");
      } catch (error) {
        handleTransactionError(error);
      }
    }
  };

  const fetchAllTransactions = async () => {
    if (contract) {
      try {
        const [cardIds, strhash, statuses] = await contract.getAllTransactions();
        const formattedTransactions = [];

        for (let i = 0; i < cardIds.length; i++) {
           if (strhash[i].slice(0, 42) === walletAddress) { // Match the address properly
            formattedTransactions.push({
              cardId: cardIds[i],
              receiverAddressW: strhash[i].slice(42, 84),
              receiverAddressR: strhash[i].slice(84, 126),
              date: strhash[i].slice(126, 136),
              receiverAddressM: strhash[i].slice(0, 42),
              status: statuses[i]
            });
           }
        }

        setAllTransactions(formattedTransactions);
        setErrorMessage("");
        setHashMismatchError("");
      } catch (error) {
        handleTransactionError(error);
      }
    }
  };

  const scanQrCode = async () => {
    try {
      const response = await axios.get("http://127.0.0.1:5000/scan_qr");
      const qrData = response.data.qr_data; // Get the string response
      console.log("Raw QR DATA", qrData)
  
      setFormInput({
        cardId: qrData.cart_id || "",
        receiverAddressM: qrData.receivers_addressM || "",
        receiverAddressW: qrData.receivers_addressW || "",
        receiverAddressR: qrData.receivers_addressR || "",
        date: qrData.date || ""
      });
      setIsQrScanned(true);
      console.log("Form input", formInput)
    } catch (error) {
      console.error("Error scanning QR code:", error.message || JSON.stringify(error));
      setErrorMessage(
        error.response?.data?.error || 
        error.message || 
        "Error scanning QR code. Please try again."
      );
    }
  };

  const lockMetaMask = async () => {
    try {
      // Revoke permissions for eth_accounts
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });
      setWalletAddress(null);
      setContract(null);
      setTokenContract(null);
      setErrorMessage("Wallet permissions revoked. Reconnect to continue.");
    } catch (error) {
      console.error("Failed to revoke MetaMask permissions:", error);
      setErrorMessage("Failed to revoke MetaMask permissions.");
    }
  };
  
  const [activeLink, setActiveLink] = useState('');
  // Set active link
  const handleLinkClick = (link) => {
    setActiveLink(link);
    lockMetaMask();
  };

  return (
    <>
      <SideManu />
      <div className="dashboard-cont">
        {/* Wallet Connection Button */}
        <div className="connect-wallet-button" onClick={loadContract}>
          <div className="wallet-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 7H5C3.89543 7 3 7.89543 3 9V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 14C16.5523 14 17 13.5523 17 13C17 12.4477 16.5523 12 16 12C15.4477 12 15 12.4477 15 13C15 13.5523 15.4477 14 16 14Z" fill="currentColor"/>
              <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="wallet-text">
            {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : "Connect Wallet"}
          </span>
          {walletAddress && <div className="connected-indicator"></div>}
        </div>

        {/* Token Information Section */}
        <TokenInfoSection 
          tokenBalance={tokenBalance}
          isAddressWhitelisted={isAddressWhitelisted}
          transactionFee={transactionFee}
          allowance={allowance}
          approveTokenSpending={approveTokenSpending}
        />

        {/* Error Message Display */}
        {errorMessage && <div className="error-toast">{errorMessage}</div>}
  
        <div className="parent-grid">
          {/* Cart Details Section */}
          <div className="div1 grid-card">
            <div className="card-header">
              <h2 className="card-title">Cart Details</h2>
              <div className="shimmer-effect"></div>
            </div>
            <div className="form-content">
              <div className="form-group">
                <label>Cart ID</label>
                <input
                  className="form-input"
                  placeholder="Card ID"
                  value={formInput.cardId}
                  onChange={(e) => setFormInput({ ...formInput, cardId: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Wholesaler Address</label>
                <input
                  className="form-input"
                  placeholder="Wholesaler Address"
                  value={formInput.receiverAddressW}
                  onChange={(e) => setFormInput({ ...formInput, receiverAddressW: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Retailer Address</label>
                <input
                  className="form-input"
                  placeholder="Retailer Address"
                  value={formInput.receiverAddressR}
                  onChange={(e) => setFormInput({ ...formInput, receiverAddressR: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  className="form-input"
                  placeholder="Select Date"
                  value={formInput.date}
                  onChange={(e) => setFormInput({ ...formInput, date: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Manufacturer Address</label>
                <input
                  className="form-input"
                  placeholder="Manufacturer Address"
                  value={walletAddress || ""}
                  disabled
                />
              </div>
              
            </div>
            
          </div>
          
          {/* QR Data Section */}
          <div className="div2 grid-card">
            <div className="card-header">
              <h2 className="card-title">QR Data</h2>
              <span className="qr-badge">Scan Status: {isQrScanned ? "Verified" : "Not Scanned"}</span>
            </div>
            <div className="qr-content">
              {formInput ? (
                <div className="qr-data-display">
                  <div className="qr-data-item">
                    <div className="qr-data-label">Cart ID</div>
                    <div className="qr-data-value">{formInput.cardId || "Not Available"}</div>
                  </div>
                  <div className="qr-data-item">
                    <div className="qr-data-label">Wholesaler</div>
                    <div className="qr-data-value">
                      {formInput.receiverAddressW && formInput.receiverAddressW.trim() !== "" && 
                       formInput.receiverAddressW !== "                                          " 
                       ? `${formInput.receiverAddressW.substring(0, 6)}...${formInput.receiverAddressW.substring(formInput.receiverAddressW.length - 4)}` 
                       : "Not Available"}
                    </div>
                  </div>
                  <div className="qr-data-item">
                    <div className="qr-data-label">Retailer</div>
                    <div className="qr-data-value">
                      {formInput.receiverAddressR && formInput.receiverAddressR.trim() !== "" && 
                       formInput.receiverAddressR !== "                                          " 
                       ? `${formInput.receiverAddressR.substring(0, 6)}...${formInput.receiverAddressR.substring(formInput.receiverAddressR.length - 4)}` 
                       : "Not Available"}
                    </div>
                  </div>
                  <div className="qr-data-item">
                    <div className="qr-data-label">Date</div>
                    <div className="qr-data-value">{formInput.date || "Not Available"}</div>
                  </div>
                  <div className="qr-data-item">
                    <div className="qr-data-label">Manufacturer</div>
                    <div className="qr-data-value">
                      {walletAddress 
                        ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` 
                        : "Not Available"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>Loading data...</p>
                </div>
              )}
            </div>
            <div className="qr-actions">
              <button className="scan-button" onClick={scanQrCode}>
                <div className="scan-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9V5H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 15V19H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 5H21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 19H21V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="7" y="7" width="3" height="3" fill="currentColor"/>
                    <rect x="14" y="7" width="3" height="3" fill="currentColor"/>
                    <rect x="7" y="14" width="3" height="3" fill="currentColor"/>
                    <rect x="14" y="14" width="3" height="3" fill="currentColor"/>
                  </svg>
                </div>
                <span>Scan QR Code</span>
              </button>
              
              <button className="payment-button" onClick={registerCardTransaction}>
                <div className="register-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 11.0801V12.0001C21.9988 14.1565 21.3005 16.2548 20.0093 17.9819C18.7182 19.7091 16.9033 20.9726 14.8354 21.584C12.7674 22.1954 10.5573 22.122 8.53447 21.3747C6.51168 20.6274 4.78465 19.2462 3.61096 17.4371C2.43727 15.628 1.87979 13.4882 2.02168 11.3364C2.16356 9.18467 2.99721 7.13643 4.39828 5.49718C5.79935 3.85793 7.69279 2.71549 9.79619 2.24025C11.8996 1.76502 14.1003 1.98245 16.07 2.86011" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span>Register Transaction</span>
              </button>
            </div>
          </div>
          
          {/* All Transactions - DIV3 */}
          <div className="div3 grid-card">
            <div className="card-header">
              <h2 className="card-title">All Transactions</h2>
              <div className="transaction-count">{allTransactions.length} transactions found</div>
            </div>
            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Cart ID</th>
                    <th>Wholesaler</th>
                    <th>Retailer</th>
                    <th>Date</th>
                    <th>Manufacturer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTransactions.map((tx, index) => (
                  <tr key={index} className="transaction-row">
                  <td>{tx.cardId}</td>
                  <td>{tx.receiverAddressW && tx.receiverAddressW !== "                                          " ? 
                    `${tx.receiverAddressW.substring(0, 6)}...${tx.receiverAddressW.substring(tx.receiverAddressW.length - 4)}` 
                    : "Not Available"}</td>
                  <td>{tx.receiverAddressR && tx.receiverAddressR !== "                                          " ? 
                    `${tx.receiverAddressR.substring(0, 6)}...${tx.receiverAddressR.substring(tx.receiverAddressR.length - 4)}` 
                    : "Not Available"}</td>
                  <td>{tx.date}</td>
                  <td>{tx.receiverAddressM && tx.receiverAddressM !== "                                          " ? 
                    `${tx.receiverAddressM.substring(0, 6)}...${tx.receiverAddressM.substring(tx.receiverAddressM.length - 4)}` 
                    : "Not Available"}</td>
                  <td>
                    <span className={`status-badge status-${tx.status.toLowerCase()}`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button 
            className="pagination-button" 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {getPaginationGroup().map(num => (
            <button
              key={num}
              className={`pagination-number ${currentPage === num ? 'active' : ''}`}
              onClick={() => setCurrentPage(num)}
            >
              {num}
            </button>
          ))}
          
          <button 
            className="pagination-button" 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, pages))}
            disabled={currentPage === pages}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</>
)};