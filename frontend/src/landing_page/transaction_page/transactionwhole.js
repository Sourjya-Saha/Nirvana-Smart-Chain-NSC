import React, { useContext, useState, useEffect } from 'react';
import { useAuth } from '../user_login/AuthContext';

import Sidebar from '../Sidebar';
import jsPDF from 'jspdf';
import { MdDelete } from "react-icons/md";
import { MdOutlinePrint } from "react-icons/md";
import { FaEye } from 'react-icons/fa';
import SideWhole from '../SideWhole';

const TransactionsWhole = () => {
  const { userId } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [originalTransactions, setOriginalTransactions] = useState([]);
  const [manufacturerUsers, setManufacturerUsers] = useState({});
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Fetch manufacturers and transactions on component mount
  useEffect(() => {
    fetchManufacturerUsers();
    if (userId) {
      fetchTransactions();
    }
  }, [userId]);

  const fetchManufacturerUsers = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/get_manufacturer_users');
      const data = await response.json();
      setManufacturerUsers(data);
    } catch (error) {
      console.error('Error fetching manufacturer users:', error);
    }
  };

  const getManufacturerName = (manuId) => {
    // Find the manufacturer name by matching the manuId as a value
    for (const [username, id] of Object.entries(manufacturerUsers)) {
      if (id === manuId) {
        return username;
      }
    }
    return 'Unknown';
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/get_all_transactions_wholesaler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json();
      console.log("Fetched Transactions:", data);
      setTransactions(data);
      setOriginalTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleDelete = async (order_id) => {
    try {
      await fetch(`http://127.0.0.1:5000/delete_transaction_whole/${order_id}`, {
        method: 'DELETE',
      });
      setTransactions(transactions.filter(transaction => transaction.order_id !== order_id));
      console.log(`Deleted Transaction ID: ${order_id}`);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleSearch = (searchQuery) => {
    const filteredTransactions = originalTransactions.filter(transaction =>
      transaction.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setTransactions(filteredTransactions);
  };

  const handleShowDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleCloseDetails = () => {
    setSelectedTransaction(null);
  };

  const calculateTotalQuantity = (orderDetails) => {
    return orderDetails.reduce((total, item) => total + item.quantity, 0);
  };

  const handlePrint = async () => {
    if (!selectedTransaction) return;
  
    const doc = new jsPDF();
    
    // Title Section
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 128);
    doc.text("Transaction Details", 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Customer Name: ${selectedTransaction.customer_name}`, 20, 30);
    doc.text(`Phone Number: ${selectedTransaction.phone_num}`, 20, 40);
    doc.text(`Order ID: ORDER#${selectedTransaction.order_id}`, 20, 50);
    doc.text(`Date & Time: ${selectedTransaction.datetime}`, 20, 60);
    doc.text(`Manufacturer: ${manufacturerUsers[selectedTransaction.manu_id] || 'Unknown'}`, 20, 70);
  
    // Product Table Header
    let yPosition = 90;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 128);
    doc.text("Transaction Details:", 20, yPosition);
  
    yPosition += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Status", 20, yPosition);
    doc.text("Total Price", 80, yPosition);
    doc.text("Product Quantity", 140, yPosition);
    doc.line(20, yPosition + 2, 180, yPosition + 2);
  
    // Transaction Details
    yPosition += 10;
    doc.setFont("helvetica", "normal");
    doc.text(selectedTransaction.status, 20, yPosition);
    doc.text(`₹${selectedTransaction.total}`, 80, yPosition);
    doc.text(String(calculateTotalQuantity(selectedTransaction.order_details)), 140, yPosition);
  
    // Products Details
    yPosition += 20;
    doc.setFont("helvetica", "bold");
    doc.text("Products:", 20, yPosition);
    
    yPosition += 10;
    selectedTransaction.order_details.forEach(product => {
      doc.setFont("helvetica", "normal");
      doc.text(`${product.product_name} - Qty: ${product.quantity} @ ₹${product.price_per_unit} each`, 20, yPosition);
      yPosition += 10;
    });
  
    doc.save('transaction-details.pdf');
  };

  return (
    <>
      <div className='dash-board'>
        <SideWhole />
        <div className="transaction-container" style={{margin:"20px"}}>
          <h2 style={{
            fontSize: '30px',
            color: '#333',
            textAlign: 'center',
            margin: '20px 0',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            borderBottom: '2px solid #FF6384',
            paddingBottom: '10px',
            width: 'fit-content',
            marginInline: 'auto',
          }}>Transactions Management</h2>
          
          <input
            type="text"
            className="search-bar"
            placeholder="Search by Customer Name"
            onChange={(e) => handleSearch(e.target.value)}
          />
          
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Your Name</th>
                <th>Your Phone Number</th>
                <th>Date & Time</th>
                <th>Total Price</th>
                <th>Product Qty</th>
                <th>Manufacturer Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.order_id}>
                  <td>ORDER#{transaction.order_id}</td>
                  <td>{transaction.customer_name}</td>
                  <td>{transaction.phone_num}</td>
                  <td>{transaction.datetime}</td>
                  <td>₹{transaction.total}</td>
                  <td>{calculateTotalQuantity(transaction.order_details)}</td>
                  <td>{getManufacturerName(transaction.manu_id)}</td>
                  <td>
                    <span className={`status ${transaction.status}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="show-button" 
                      onClick={() => handleShowDetails(transaction)}
                      style={{ fontSize: "1rem", marginRight: "5px" }}
                    >
                      <FaEye />
                    </button>
                    <button 
                      className="delete-button" 
                      onClick={() => handleDelete(transaction.order_id)}
                      style={{ fontSize: "1rem" }}
                    >
                      <MdDelete />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedTransaction && (
            <div className='modal-overlay' style={{
              backdropFilter: 'blur(5px)',
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}>
              <div className="transaction-details-modal" style={{
                width: "60%",
                maxWidth: "1000px",
                backgroundColor: "#fff",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                borderRadius: "8px",
                padding: "20px",
                maxHeight: "90vh",
                overflowY: "auto"
              }}>
                <h2 style={{
                  fontSize: '25px',
                  color: '#333',
                  textAlign: 'center',
                  margin: '20px 0',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  borderBottom: '2px solid #FF6384',
                  paddingBottom: '10px'
                }}>Transaction Details</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <strong>Order ID:</strong> ORDER#{selectedTransaction.order_id}
                  </div>
                  <div>
                    <strong>Customer Name:</strong> {selectedTransaction.customer_name}
                  </div>
                  <div>
                    <strong>Customer Phone:</strong> {selectedTransaction.phone_num}
                  </div>
                  <div>
                    <strong>Date & Time:</strong> {selectedTransaction.datetime}
                  </div>
                  <div>
                    <strong>Manufacturer:</strong> {getManufacturerName(selectedTransaction.manu_id)}
                  </div>
                  <div>
                    <strong>Status:</strong> {selectedTransaction.status}
                  </div>
                  <div>
                    <strong>Total Price:</strong> ₹{selectedTransaction.total}
                  </div>
                  <div>
                    <strong>Product Quantity:</strong> {calculateTotalQuantity(selectedTransaction.order_details)}
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <strong>Order Details:</strong>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                      <tr>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Product Name</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Quantity</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Price per Unit</th>
                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Total Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTransaction.order_details.map((product, index) => (
                        <tr key={index}>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>{product.product_name}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>{product.quantity}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{product.price_per_unit}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{product.total_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  marginTop: '20px' 
                }}>
                  <button 
                    onClick={handlePrint}
                    style={{
                      padding: '10px 20px',
                      fontSize: '1rem',
                      borderRadius: '5px',
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      marginRight: '10px'
                    }}
                  >
                    <MdOutlinePrint /> Print
                  </button>
                  <button 
                    onClick={handleCloseDetails}
                    style={{
                      padding: '10px 20px',
                      fontSize: '1rem',
                      borderRadius: '5px',
                      backgroundColor: '#f44336',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TransactionsWhole;