import React, { useState, useEffect } from "react";
import { ethers } from 'ethers'; // ethers v6
import axios from 'axios';
import CardTransactionRegistry from "./CardTransactionRegistry.json"; // Import your ABI JSON
import NirvanaTokenABI from "./NirvanaToken.json"; // Import the token ABI
import SideWhole from "../SideWhole";
import './Shipment.css'; // Import the CSS file

import contractConfig from './contractAddress.json';
import TokenInfoSection from "./TokenInfoSection";

export default function Receive() {
  const [walletAddress, setWalletAddress] = useState(null); // for storing connected wallet address
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
  const [hashMismatchError, setHashMismatchError] = useState(""); // For hash mismatch errors
  const [allTransactions, setAllTransactions] = useState([]); // State to store all transactions
  const [sentTransactions, setSentTransactions] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [razorpayOrderData, setRazorpayOrderData] = useState(null);
  const [isQrScanned, setIsQrScanned] = useState(false);
  const [isTransactionSuccess, setIsTransactionSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [isPaymentValidated, setIsPaymentValidated] = useState(false);
  
  const contractAddress = contractConfig.address; // Your contract address

  // Get current transactions for pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = allTransactions.slice(indexOfFirstItem, indexOfLastItem);
  
  // Calculate total pages
  const pages = Math.ceil(allTransactions.length / itemsPerPage);
  
  // Function to get pagination group
  const getPaginationGroup = () => {
    const start = Math.floor((currentPage - 1) / 5) * 5;
    return new Array(Math.min(5, pages - start)).fill().map((_, idx) => start + idx + 1);
  };

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
      fetchSentTransactions();
      fetchTokenDetails();
      setErrorMessage(""); // Call this only after the contract and wallet address are set
      setHashMismatchError("");
    }
  }, [contract, walletAddress, tokenContract]); // Dependencies

  const loadContract = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        
        const checksummedAddress = ethers.getAddress(accounts[0]); // Get the checksummed address
        setWalletAddress(checksummedAddress); // Store the checksummed address
    
        const provider = new ethers.BrowserProvider(window.ethereum); // Create a provider for MetaMask
        const signer = await provider.getSigner(checksummedAddress); // Get the signer for the wallet address
        
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
        
        // Transaction for approval
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
    setFormInput({
      cardId: formInput.cardId || "",
      receiverAddressW: formInput.receiverAddressW || "",
      receiverAddressR: formInput.receiverAddressR || "                                          ",
      date: formInput.date || "",
      receiverAddressM: formInput.receiverAddressM || "                                          ",
    });
    
    if (error.message && error.message.includes("Hash mismatch")) {
      const hashData = error.reason.slice(15);

      // Check conditions and set appropriate error message
      if (hashData.slice(0, 42) !== formInput.receiverAddressM) {
        setErrorMessage("Manufacturer wallet address mismatch");
      } 
      if (hashData.slice(42, 84) !== walletAddress) {
        setErrorMessage("Wholesaler wallet address mismatch");
      } 
      if (hashData.slice(84, 126) !== formInput.receiverAddressR) {
        setErrorMessage("Retailer wallet address mismatch");
      } 
      if (hashData.slice(126, 136) !== formInput.date) {
        setErrorMessage("Date mismatch");
      }
      
      setHashMismatchError(hashData);
    } else if (error.message && error.message.includes("ERC20: transfer to non-whitelisted address")) {
      setErrorMessage("Cannot transfer to a non-whitelisted address!");
    } else if (error.message && error.message.includes("Fee payment failed")) {
      setErrorMessage("Transaction fee payment failed. Please check your token balance and allowance.");
    } else {
      setErrorMessage(error.reason || error.message || "An unknown error occurred");
    }
  };
   
  const fetchAllTransactions = async () => {
    if (contract) {
      try {
        const [cardIds, strhash, statuses] = await contract.getAllTransactions();
        const formattedTransactions = [];

        for (let i = 0; i < cardIds.length; i++) {
          if (strhash[i].slice(42, 84) === walletAddress) { // Match the wholesaler address
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

  const fetchSentTransactions = async () => {
    if (contract) {
      try {
        const [cardIds, strhash, statuses] = await contract.getAllTransactions();
        const formattedTransactions = [];

        for (let i = 0; i < cardIds.length; i++) {
          // Check transactions where this wholesaler is the sender
          if (strhash[i].slice(0, 42) === "                                          " && 
              strhash[i].slice(42, 84) === walletAddress) {
            formattedTransactions.push({
              cardId: cardIds[i],
              wholesalerAddress: strhash[i].slice(42, 84),
              retailerAddress: strhash[i].slice(84, 126),
              date: strhash[i].slice(126, 136),
              status: statuses[i]
            });
          }
        }

        setSentTransactions(formattedTransactions);
      } catch (error) {
        console.error("Error fetching sent transactions:", error);
      }
    }
  };

  // Function to fetch transactions by multiple fields for wholesaler
  const fetchCardTransactionWR = async () => {
    if (contract) {
      try {
        // Check if we have enough allowance
        const fee = await contract.transactionFee();
        const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        
        if (currentAllowance < fee) {
          setErrorMessage("Insufficient token allowance. Please approve tokens first.");
          return;
        }
        
        const { cardId, receiverAddressW, receiverAddressR, date, receiverAddressM } = formInput;
        const merged = receiverAddressM + walletAddress + "                                          " + date + cardId;
        
        const transactionData = await contract.searchCardTransactionWR(merged);
        await transactionData.wait(); // Wait for the transaction to be mined
        console.log(transactionData);
        fetchAllTransactions(); // Refresh the all transactions list after validating
        fetchTokenDetails(); // Update token details after transaction
        setErrorMessage(""); // Clear any previous error messages
        setHashMismatchError("");
        setIsPaymentValidated(true);
        setPaymentStatus("validated");
        alert("QR validated successfully!");
      } catch (error) {
        handleTransactionError(error);
      }
    }
  };

  const registerCardTransactionW = async () => {
    if (contract) {
      try {
        // Check if retailer address is whitelisted
        if (formInput.receiverAddressR && formInput.receiverAddressR.length === 42) {
          const isRetailerWhitelisted = await tokenContract.isWhitelisted(formInput.receiverAddressR);
          if (!isRetailerWhitelisted) {
            setErrorMessage("Retailer address is not whitelisted!");
            return;
          }
        }
        
        // Check if we have enough allowance
        const fee = await contract.transactionFee();
        const currentAllowance = await tokenContract.allowance(walletAddress, contractAddress);
        
        if (currentAllowance < fee) {
          setErrorMessage("Insufficient token allowance. Please approve tokens first.");
          return;
        }
        
        const { cardId, receiverAddressR, date } = formInput;
        const merged = "                                          " + walletAddress + receiverAddressR + date + cardId;
        
        const transaction = await contract.registerCardTransactionW(merged);
        await transaction.wait(); 
        
        // Add API call after blockchain transaction is successful
        const apiResponse = await axios.post('http://127.0.0.1:5000/add_transaction', {
          cart_id: cardId,
          manu_add: "                                          ", // Empty for wholesaler-to-retailer
          whole_add: walletAddress,
          ret_add: receiverAddressR
        });

        // Check if API call was successful
        if (apiResponse.status === 200) {
          setFormInput({
            cardId: "", 
            receiverAddressW: "", 
            receiverAddressR: "                                          ", 
            date: "", 
            receiverAddressM: "                                          "
          });
          fetchAllTransactions();
          fetchSentTransactions();
          fetchTokenDetails(); // Update token details after transaction
          setErrorMessage(""); // Clear any previous error messages
          setHashMismatchError("");
          setIsTransactionSuccess(true);
          // Hide success message after 3 seconds
          setTimeout(() => {
            setIsTransactionSuccess(false);
          }, 3000);
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

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  // Create Razorpay order
  const createRazorpayOrder = async () => {
    if (!formInput.cardId) {
      setErrorMessage("No cart ID found. Please scan QR first.");
      return;
    }

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setErrorMessage("Failed to load payment system. Please try again.");
        return;
      }

      console.log("Creating Razorpay order for cart ID:", formInput.cardId);
      
      const response = await axios.post('http://127.0.0.1:5000/create_razorpay_order_transactions_whole_to_manu', {
        cart_id: formInput.cardId
      });
      
      console.log("Razorpay order response:", response.data);

      if (response.data.error) {
        setErrorMessage(response.data.error);
        return;
      }

      setRazorpayOrderData(response.data);

      const options = {
        key: 'rzp_test_2EpPSCTb8XHFCk',
        amount: response.data.total_amount * 100,
        currency: "INR",
        name: 'Cart Transaction',
        description: 'Payment for cart validation',
        order_id: response.data.razorpay_order_id,
        handler: function (paymentResponse) {
          // Immediately make verification API call
          handlePaymentVerification(paymentResponse, response.data.temp_order_data);
        },
        modal: {
          ondismiss: function() {
            console.log("Checkout form closed");
            setErrorMessage("Payment cancelled");
            setPaymentStatus('pending');
          }
        },
        prefill: {
          email: 'user@example.com',
          contact: '9999999999'
        },
        theme: {
          color: '#F37254'
        }
      };

      const rzp = new window.Razorpay(options);
      
      // Add payment failure handler
      rzp.on('payment.failed', function (resp) {
        console.error('Payment failed:', resp.error);
        setErrorMessage(`Payment failed: ${resp.error.description}`);
        setPaymentStatus('failed');
      });

      rzp.open();

    } catch (error) {
      console.error("Error in payment process:", error);
      setErrorMessage(error.response?.data?.error || error.message);
    }
  };

  // Handle payment verification
  const handlePaymentVerification = async (paymentResponse, tempOrderData) => {
    try {
      console.log("Verifying payment:", paymentResponse);
      
      const verifyResponse = await axios.post(
        'http://127.0.0.1:5000/confirm_order_payment_transactions_whole_to_manu',
        {
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_signature: paymentResponse.razorpay_signature,
          temp_order_data: tempOrderData
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log("Verification response:", verifyResponse.data);

      if (verifyResponse.data.status === 'success') {
        setPaymentStatus('completed');
        setErrorMessage("Payment successful! You can now validate the QR.");
      } else {
        throw new Error(verifyResponse.data.message || "Payment verification failed");
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      setErrorMessage(error.response?.data?.error || "Payment verification failed");
      setPaymentStatus('failed');
    }
  };

  const scanQrCode = async () => {
    try {
      const response = await axios.get("http://127.0.0.1:5000/scan_qr");
      const qrData = response.data.qr_data;
      console.log("Raw QR DATA", qrData);

      setFormInput({
        cardId: qrData.cart_id || "",
        receiverAddressM: qrData.receivers_addressM || "",
        receiverAddressW: qrData.receivers_addressW || "",
        receiverAddressR: qrData.receivers_addressR || "",
        date: qrData.date || ""
      });

      setPaymentStatus('pending');
      setIsQrScanned(false);

      const verifyTransaction = async () => {
        let isValid = true;

        const matchingTransaction = allTransactions.find(
          transaction => transaction.cardId === qrData.cart_id
        );

        const addressm = qrData.receivers_addressM || "                                          ";
        const addressw = qrData.receivers_addressW || "                                          ";
        const addressr = qrData.receivers_addressR || "                                          ";

        console.log("Matching Transaction:", matchingTransaction);

        if (!matchingTransaction) {
          setErrorMessage(`Card ID ${qrData.cart_id} is not registered yet`);
          isValid = false;
          return;
        }

        if (matchingTransaction && matchingTransaction.receiverAddressW !== walletAddress) {
          setErrorMessage(`Wallet ~ ${walletAddress} is not associated to Card ID ${qrData.cart_id}`);
          isValid = false;
          return;
        }

        // Verify each field
        if (matchingTransaction.receiverAddressW !== walletAddress) {
          setErrorMessage(`For Card-Id ${qrData.cart_id} => incorrect wholesaler address`);
          isValid = false;
        } else {
          console.log("whole okay");
        }

        if (matchingTransaction.receiverAddressR !== addressr) {
          setErrorMessage(`For Card-Id ${qrData.cart_id} => incorrect retailer address`);
          isValid = false;
        } else {
          console.log("retailer okay");
        }

        if (matchingTransaction.date !== qrData.date) {
          setErrorMessage(`For Card-Id ${qrData.cart_id} => incorrect date`);
          isValid = false;
        } else {
          console.log("date okay");
        }

        if (matchingTransaction.receiverAddressM !== addressm) {
          setErrorMessage(`For Card-Id ${qrData.cart_id} => incorrect manufacture address`);
          isValid = false;
        } else {
          console.log("manu okay");
        }

        console.log("Form input", formInput);

        // Only enable payment if all verifications pass
        if (isValid) {
          setIsQrScanned(true);
          setErrorMessage("QR code verified successfully. Please proceed with payment.");
        }
      };

      // Execute verification after setting form input
      await verifyTransaction();
    } catch (error) {
      console.error("Error scanning QR code:", error.message || JSON.stringify(error));
      setErrorMessage(
        error.response?.data?.error || 
        error.message || 
        "Error scanning QR code. Please try again."
      );
      setIsQrScanned(false);
    }
  };

  return (
    <>
      <SideWhole />
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
                  placeholder="Cart ID"
                  value={formInput.cardId}
                  onChange={(e) => setFormInput({ ...formInput, cardId: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Wholesaler Address</label>
                <input
                  className="form-input"
                  disabled={true}
                  placeholder="Wholesaler Address"
                  value={walletAddress || ""}
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
                  value={formInput.receiverAddressM}
                  onChange={(e) => setFormInput({ ...formInput, receiverAddressM: e.target.value })}
                />
              </div>
              
              <button 
                className="register-shipment-button" 
                onClick={registerCardTransactionW}
              >
                Register New Shipment
              </button>
              
              {isTransactionSuccess && (
                <div className="success-message">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 11.0801V12.0001C21.9988 14.1565 21.3005 16.2548 20.0093 17.9819C18.7182 19.7091 16.9033 20.9726 14.8354 21.584C12.7674 22.1954 10.5573 22.122 8.53447 21.3747C6.51168 20.6274 4.78465 19.2462 3.61096 17.4371C2.43727 15.628 1.87979 13.4882 2.02168 11.3364C2.16356 9.18467 2.99721 7.13643 4.39828 5.49718C5.79935 3.85793 7.69279 2.71549 9.79619 2.24025C11.8996 1.76502 14.1003 1.98245 16.07 2.86011" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 4L12 14.01L9 11.01" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Transaction registered successfully!</span>
                </div>
              )}
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
                    <div className="qr-data-label">Manufacturer</div>
                    <div className="qr-data-value">
                      {formInput.receiverAddressM && formInput.receiverAddressM.trim() !== "" && 
                       formInput.receiverAddressM !== "                                          " 
                       ? `${formInput.receiverAddressM.substring(0, 6)}...${formInput.receiverAddressM.substring(formInput.receiverAddressM.length - 4)}` 
                       : "Not Available"}
                    </div>
                  </div>
                  <div className="qr-data-item">
                    <div className="qr-data-label">Wholesaler</div>
                    <div className="qr-data-value">
                      {walletAddress 
                        ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` 
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
                </div>
              ) : (
                <div className="qr-scan-placeholder">
                  <div className="qr-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 11L3 3L11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 11L21 3L13 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 13L3 21L11 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 13L21 21L13 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p>No QR data available. Please scan a QR code.</p>
                </div>
              )}
              
              <div className="qr-action-buttons">
                <button
                  className="qr-scan-button"
                  onClick={scanQrCode}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 7V5C3 3.89543 3.89543 3 5 3H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M17 3H19C20.1046 3 21 3.89543 21 5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 17V19C21 20.1046 20.1046 21 19 21H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 21H5C3.89543 21 3 20.1046 3 19V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Scan QR
                </button>
                
                {isQrScanned && paymentStatus === 'pending' && (
                  <button
                    className="payment-button"
                    onClick={createRazorpayOrder}
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Proceed to Payment
                  </button>
                )}
                
                <button
                  className={`validate-button ${paymentStatus !== 'completed' ? 'disabled' : ''}`}
                  onClick={fetchCardTransactionWR}
                  disabled={paymentStatus !== 'completed'}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22 11.0801V12.0001C21.9988 14.1565 21.3005 16.2548 20.0093 17.9819C18.7182 19.7091 16.9033 20.9726 14.8354 21.584C12.7674 22.1954 10.5573 22.122 8.53447 21.3747C6.51168 20.6274 4.78465 19.2462 3.61096 17.4371C2.43727 15.628 1.87979 13.4882 2.02168 11.3364C2.16356 9.18467 2.99721 7.13643 4.39828 5.49718C5.79935 3.85793 7.69279 2.71549 9.79619 2.24025C11.8996 1.76502 14.1003 1.98245 16.07 2.86011" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Validate QR as Wholesaler
                </button>
              </div>
            </div>
          </div>
          
          {/* Transactions Tables */}
          <div className="div3 grid-card">
            <div className="card-header">
              <h2 className="card-title">All Transactions</h2>
              <div className="shimmer-effect"></div>
            </div>
            <div className="transactions-content">
              {!walletAddress ? (
                <div className="no-data-message">Please connect your wallet to view transactions.</div>
              ) : allTransactions.length > 0 ? (
                <>
                  <div className="table-container">
                    <table className="transactions-table">
                      <thead>
                        <tr>
                          <th>Cart ID</th>
                          <th>Wholesaler Address</th>
                          <th>Retailer Address</th>
                          <th>Date</th>
                          <th>Manufacturer Address</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTransactions.map((tx, index) => (
                          <tr key={index}>
                            <td>{tx.cardId}</td>
                            <td title={tx.receiverAddressW}>{`${tx.receiverAddressW.substring(0, 6)}...${tx.receiverAddressW.substring(tx.receiverAddressW.length - 4)}`}</td>
                            <td title={tx.receiverAddressR}>{`${tx.receiverAddressR.substring(0, 6)}...${tx.receiverAddressR.substring(tx.receiverAddressR.length - 4)}`}</td>
                            <td>{tx.date}</td>
                            <td title={tx.receiverAddressM}>{`${tx.receiverAddressM.substring(0, 6)}...${tx.receiverAddressM.substring(tx.receiverAddressM.length - 4)}`}</td>
                            <td>
                            <span className='status-badge'>
                              {tx.status}
                            </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination controls */}
                  {pages > 1 && (
                    <div className="pagination-controls">
                      <button 
                        onClick={() => setCurrentPage(1)} 
                        disabled={currentPage === 1}
                        className="pagination-button"
                      >
                        &laquo;
                      </button>
                      <button 
                        onClick={() => setCurrentPage(currentPage - 1)} 
                        disabled={currentPage === 1}
                        className="pagination-button"
                      >
                        &lt;
                      </button>
                      
                      {getPaginationGroup().map(item => (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item)}
                          className={`pagination-button ${currentPage === item ? 'active' : ''}`}
                        >
                          {item}
                        </button>
                      ))}
                      
                      <button 
                        onClick={() => setCurrentPage(currentPage + 1)} 
                        disabled={currentPage === pages}
                        className="pagination-button"
                      >
                        &gt;
                      </button>
                      <button 
                        onClick={() => setCurrentPage(pages)} 
                        disabled={currentPage === pages}
                        className="pagination-button"
                      >
                        &raquo;
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-data-message">No transactions found.</div>
              )}
            </div>
          </div>
          
          {/* Sent Transactions Table */}
          <div className="div4 grid-card">
            <div className="card-header">
              <h2 className="card-title">Sent Transactions to Retailer</h2>
              <div className="shimmer-effect"></div>
            </div>
            <div className="transactions-content">
              {!walletAddress ? (
                <div className="no-data-message">Please connect your wallet to view sent transactions.</div>
              ) : sentTransactions.length > 0 ? (
                <div className="table-container">
                  <table className="transactions-table">
                    <thead>
                      <tr>
                        <th>Cart ID</th>
                        <th>Wholesaler Address</th>
                        <th>Retailer Address</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentTransactions.map((tx, index) => (
                        <tr key={index}>
                          <td>{tx.cardId}</td>
                          <td title={tx.wholesalerAddress}>{`${tx.wholesalerAddress.substring(0, 6)}...${tx.wholesalerAddress.substring(tx.wholesalerAddress.length - 4)}`}</td>
                          <td title={tx.retailerAddress}>{`${tx.retailerAddress.substring(0, 6)}...${tx.retailerAddress.substring(tx.retailerAddress.length - 4)}`}</td>
                          <td>{tx.date}</td>
                          <td>
                            <span className='status-badge'>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-data-message">No sent transactions found.</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Add this CSS to your Shipment.css file */}
        {/* 
        .parent-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: auto auto;
          grid-gap: 20px;
          margin-top: 20px;
        }
        
        .grid-card {
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .div1 { grid-area: 1 / 1 / 2 / 2; }
        .div2 { grid-area: 1 / 2 / 2 / 3; }
        .div3 { grid-area: 2 / 1 / 3 / 3; }
        .div4 { grid-area: 3 / 1 / 4 / 3; }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: linear-gradient(to right, #6a11cb, #2575fc);
          color: white;
        }
        
        .card-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .form-content {
          padding: 20px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #555;
        }
        
        .form-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          font-size: 14px;
        }
        
        .register-shipment-button {
          width: 100%;
          padding: 12px;
          background: linear-gradient(to right, #6a11cb, #2575fc);
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .register-shipment-button:hover {
          background: linear-gradient(to right, #5a0fc9, #1e6dfc);
          transform: translateY(-2px);
        }
        
        .qr-content {
          padding: 20px;
          min-height: 300px;
          display: flex;
          flex-direction: column;
        }
        
        .qr-data-display {
          flex-grow: 1;
        }
        
        .qr-data-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        
        .qr-data-label {
          font-weight: 500;
          color: #555;
        }
        
        .qr-data-value {
          color: #333;
          font-family: 'Courier New', monospace;
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
        }
        
        .qr-action-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
          margin-top: 20px;
        }
        
        .qr-scan-button, .payment-button, .validate-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border: none;
          border-radius: 5px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .qr-scan-button {
          background: #4CAF50;
          color: white;
        }
        
        .payment-button {
          background: #FF5733;
          color: white;
        }
        
        .validate-button {
          background: #2196F3;
          color: white;
        }
        
        .validate-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .qr-scan-button:hover, .payment-button:hover, .validate-button:hover:not(.disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .qr-scan-button svg, .payment-button svg, .validate-button svg {
          width: 18px;
          height: 18px;
        }
        
        .qr-badge {
          background: #f0f0f0;
          color: #333;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .transactions-content {
          padding: 20px;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .transactions-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .transactions-table th, .transactions-table td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        
        .transactions-table th {
          background-color: #f5f5f5;
          font-weight: 600;
        }
        
        .transactions-table tr:hover {
          background-color: #f9f9f9;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-badge.complete {
          background-color: #e8f5e9;
          color: #2e7d32;
        }
        
        .status-badge.pending {
          background-color: #fff8e1;
          color: #ff8f00;
        }
        
        .pagination-controls {
          display: flex;
          justify-content: center;
          gap: 5px;
          margin-top: 20px;
        }
        
        .pagination-button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .pagination-button.active {
          background: #6a11cb;
          color: white;
          border-color: #6a11cb;
        }
        
        .pagination-button:hover:not(:disabled) {
          background: #f0f0f0;
        }
        
        .pagination-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .shimmer-effect {
          position: relative;
          overflow: hidden;
          background: linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.2), rgba(255,255,255,0.1));
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          height: 2px;
          width: 60px;
        }
        
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        
        .no-data-message {
          text-align: center;
          padding: 30px 0;
          color: #888;
          font-style: italic;
        }
        
        .success-message {
          display: flex;
          align-items: center;
          gap: 10px;
          background-color: #e8f5e9;
          color: #2e7d32;
          padding: 10px;
          border-radius: 5px;
          margin-top: 15px;
        }
        
        .success-message svg {
          width: 20px;
          height: 20px;
        }
        
        .error-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: #ffebee;
          color: #c62828;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          animation: fadeIn 0.3s, fadeOut 0.3s 5s forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }
        
        .connect-wallet-button {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }
        
        .connect-wallet-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .wallet-icon {
          width: 20px;
          height: 20px;
          color: #6a11cb;
        }
        
        .wallet-text {
          font-weight: 500;
        }
        
        .connected-indicator {
          width: 8px;
          height: 8px;
          background-color: #4CAF50;
          border-radius: 50%;
          margin-left: auto;
        }
        
        .qr-scan-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-grow: 1;
          color: #888;
        }
        
        .qr-scan-placeholder .qr-icon {
          width: 60px;
          height: 60px;
          margin-bottom: 15px;
          color: #ddd;
        }
        */}
      </div>
    </>
  );
}