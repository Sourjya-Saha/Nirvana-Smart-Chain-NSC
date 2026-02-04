import React, { useContext, useState, useEffect } from 'react';
import { useAuth } from '../user_login/AuthContext'; // Import the AuthContext
import './Order.css';
import Sidebar from '../Sidebar';
import jsPDF from 'jspdf';
import { MdDelete } from "react-icons/md";
import { MdOutlinePrint } from "react-icons/md";
import { FaPen } from 'react-icons/fa6';
import { FaGooglePay } from "react-icons/fa";
import QRCode from 'qrcode';

const Orders = () => {
  const { userId } = useAuth(); // Get the logged-in user ID
  const [orders, setOrders] = useState([]);
  const [originalOrders, setOriginalOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);

  // Fetch orders and products on component mount based on user ID
  useEffect(() => {
    if (userId) {
      fetchOrders();
      fetchProducts();
    }
  }, [userId]);

  const fetchOrders = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/getAllOrders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }), // Ensure key matches backend
      });
      const data = await response.json();
      console.log("Fetched Orders:", data); // Debugging line
      setOrders(data);
      setOriginalOrders(data); // Store original orders for filtering
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };
  

  const fetchProducts = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/getProducts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await response.json();
      console.log("Fetched Products:", data); // Debugging line
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };
  const handleEdit = (order) => {
    const productsWithDetails = order.order_details.map(product => ({
      ...product,
      product_name: product.product_name || "", // Ensure name is present
      price: product.price_per_unit || 0,                // Ensure price is present
      quantity: product.quantity || 1           // Use existing quantity or default
    }));
  
    setEditingOrder({
      ...order,
      products: productsWithDetails,
    });
  
    console.log("Editing Order with Detailed Products:", productsWithDetails); // Debugging line
  };
  

  const handleDelete = async (id) => {
    try {
      await fetch(`http://127.0.0.1:5000/delete_order/${id}`, {
        method: 'DELETE',
      });
      setOrders(orders.filter(order => order.order_id !== id));
      console.log(`Deleted Order ID: ${id}`); // Debugging line
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  };

  const handleProductQuantityChange = (productId, newQuantity) => {
    if (newQuantity < 0) {
      alert("Quantity cannot be negative.");
      return;
    }

    setEditingOrder(prevOrder => {
      const updatedProducts = prevOrder.products.map(product => {
        if (product.product_id === productId) {
          const maxQuantity = product.availableStock;
          if (newQuantity > maxQuantity) {
            alert(`Quantity cannot exceed available stock of ${maxQuantity}.`);
            return product; // Return the original product if the new quantity exceeds stock
          }
          return { ...product, quantity: newQuantity }; // Update quantity
        }
        return product; // Return other products unchanged
      });

      const updatedOrder = { ...prevOrder, products: updatedProducts }; // Return updated order
      console.log("Updated Order on Quantity Change:", updatedOrder); // Debugging line
      return updatedOrder;
    });
  };

  const handlePay = async () => {
    if (editingOrder && editingOrder.products) { 
      const total_price = editingOrder.products.reduce((sum, product) => {
        return sum + (product.price_per_unit * product.quantity);
      }, 0);// Ensure products is defined
      const updatedOrder = {
        order_id: editingOrder.order_id,
        customer_name: editingOrder.customer_name,
        phone_num: editingOrder.phone_num,
        datetime:editingOrder.datetime,
        total: total_price,
        status: 'paid',
        order_details: editingOrder.products.map(product => ({
          product_id: product.product_id,
          quantity: product.quantity,
        })),
      };
  
      console.log("Submitting Order for Payment:", updatedOrder); // Debugging line
  
      try {
        const response = await fetch('http://127.0.0.1:5000/updateOrder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOrder),
        });
  
        if (response.ok) {
          const updatedOrderData = await response.json();
          console.log("Updated Order Response:", updatedOrderData); // Debugging line
          setOrders(orders.map(order =>
            order.order_id === updatedOrderData.order_id ? { ...editingOrder, status: 'paid' } : order
          ));
          setEditingOrder(null); // Close the editing modal
        } else {
          const errorResponse = await response.json();
          console.error('Error updating order status:', errorResponse.error);
        }
      } catch (error) {
        console.error('Error updating order status:', error);
      }
    } else {
      console.error("Editing order or products is not defined."); // Handle case where products are not defined
    }
  };
  

  const handleSave = async () => {
    if (editingOrder) {
      const total_price = editingOrder.products.reduce((sum, product) => {
        return sum + (product.price_per_unit * product.quantity);
      }, 0);
  
      const updatedOrder = {
        order_id: editingOrder.order_id,
        customer_name: editingOrder.customer_name,
        phone_num: editingOrder.phone_num,
        datetime: editingOrder.datetime,
        status: editingOrder.status,
        total: total_price,
        order_details: editingOrder.products.map(product => ({
          product_id: product.product_id,
          product_name: product.product_name,
          price_per_unit: product.price_per_unit,
          quantity: product.quantity,
        })),
      };
  
      console.log("Saving Edited Order with Total Price and Details:", updatedOrder); // Debugging line
  
      try {
        const response = await fetch('http://127.0.0.1:5000/updateOrder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedOrder),
        });
  
        if (response.ok) {
          const updatedOrderData = await response.json();
          console.log("Saved Order Response:", updatedOrderData); // Debugging line
          setOrders(orders.map(order =>
            order.order_id === updatedOrderData.order_id ? updatedOrder : order
          ));
          setEditingOrder(null); // Close the editing modal
        } else {
          const errorResponse = await response.json();
          console.error('Error updating order:', errorResponse.error);
        }
      } catch (error) {
        console.error('Error updating order:', error);
      }
    }
  };
  

  const handleCancel = () => {
    setEditingOrder(null);
    console.log("Edit Canceled"); // Debugging line
  };

  const handleSearch = (searchQuery) => {
    const filteredOrders = originalOrders.filter(order =>
      order.customer_name.toLowerCase().includes(searchQuery)
    );
    setOrders(filteredOrders);
    console.log("Filtered Orders:", filteredOrders); // Debugging line
  };

  const handlePrint = async () => {
    if (!editingOrder) return;
  
    const doc = new jsPDF();
    
    // Title Section
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 128); // Set color to dark blue
    doc.text("Customer Details", 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Reset color to black
    doc.text(`Name: ${editingOrder.customer_name}`, 20, 30);
    doc.text(`Phone: ${editingOrder.phone_num}`, 20, 40);
    doc.text(`Order ID: ORDER#${editingOrder.order_id}`, 20, 50);
    doc.text(`Date & Time: ${new Date(editingOrder.datetime).toLocaleString()}`, 20, 60);
  
    // Product Table Header
    let yPosition = 80;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 128);
    doc.text("Product Details:", 20, yPosition);
  
    yPosition += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Product Name", 20, yPosition);
    doc.text("Quantity", 80, yPosition);
    doc.text("Price per Unit ", 110, yPosition);
    doc.text("Total Price ", 150, yPosition);
    doc.line(20, yPosition + 2, 180, yPosition + 2); // Underline headers
  
    // Product Rows
    yPosition += 10;
    doc.setFont("helvetica", "normal");
  
    editingOrder.products.forEach((product, index) => {
      if (yPosition > 270) { // Add new page if needed
        doc.addPage();
        yPosition = 20;
      }
  
      const totalPrice = product.quantity * (product.price_per_unit || 0);
  
      // Alternate row color
      if (index % 2 === 0) {
        doc.setFillColor(240, 240, 240); // Light gray
        doc.rect(20, yPosition - 5, 160, 10, "F"); // Draw filled rectangle
      }
  
      doc.text(product.product_name || "N/A", 20, yPosition);
      doc.text(String(product.quantity), 80, yPosition);
      doc.text(`Rs. ${(product.price_per_unit || 0).toFixed(2)}`, 110, yPosition);
      doc.text(`Rs. ${totalPrice.toFixed(2)}`, 150, yPosition);
      yPosition += 10;
    });
  
    // Total and Status
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 128, 0); // Green color for total
    doc.text(`Total Order Price: Rs. ${editingOrder.total.toFixed(2)}`, 20, yPosition + 10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Status: ${editingOrder.status}`, 20, yPosition + 20);
  
    // Generate and Insert QR Code
    const qrCodeData = `Order Details:\nName: ${editingOrder.customer_name}\nPhone: ${editingOrder.phone_num}\nTotal Price: ₹${editingOrder.total.toFixed(2)}`;
    try {
      const qrCodeUrl = await QRCode.toDataURL(qrCodeData, { width: 40, height: 40 });
      doc.addImage(qrCodeUrl, 'PNG', 140, 20, 40, 40);
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  
    doc.save('order-details.pdf');
  };
  


  return (
    <>
      <div className='dash-board'>
        <Sidebar />
        <div className="order-container">
        <h2 style={{
    fontSize: '30px', // Adjust font size
    color: '#333', // Dark gray color
    textAlign: 'center', // Center align text
    margin: '20px 0', // Add space above and below
    fontWeight: 'bold', // Make the text bold
    textTransform: 'uppercase', // Make text uppercase
    letterSpacing: '1.5px', // Add spacing between letters
    borderBottom: '2px solid #FF6384', // Add an underline effect
    paddingBottom: '10px', // Space between text and underline
    width: 'fit-content', // Fit content width
    marginInline: 'auto' ,
    // Center horizontally
  }}>Orders management</h2>
          <input
            type="text"
            className="search-bar"
            placeholder="Search by Customer Name"
            onChange={(e) => handleSearch(e.target.value)}
          />
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Date & Time</th>
                <th>Product Qty</th>
                <th>Total Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_id}>
                  <td>ORDER#{order.order_id}</td>
                  <td>{order.customer_name}</td>
                  <td>{order.phone_num}</td>
                  <td>{order.datetime}</td>
                  <td>{order.order_details.length}</td>
                  <td>₹{order.total}</td>
                  <td>
                    <span className={`status ${order.status}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className='product-table-buttons'>
                    <button className="edit-button" onClick={() => handleEdit(order)}   style={{ fontSize: "1rem" }}><FaPen /></button>
                    <button className="action-button" onClick={() => handleDelete(order.order_id)}   style={{ fontSize: "1rem" }}><MdDelete />
          
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
         
          {editingOrder && (
            <div className='modal-overlay' style={{
              backdropFilter: 'blur(5px)',  // Applying a blur effect with a 5px radius
            }}>
            <div className="edit-order-modal"   style={{
              width: "60%",
              maxWidth: "1000px",
              margin: "0 auto",
              padding: "20px",
              backgroundColor: "#fff",
              boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
              borderRadius: "8px",
              overflow: "auto",
              maxHeight: "90vh", // Limit height to prevent overflow
            }}>
                 <h2 style={{
    fontSize: '30px', // Adjust font size
    color: '#333', // Dark gray color
    textAlign: 'center', // Center align text
    margin: '20px 0', // Add space above and below
    fontWeight: 'bold', // Make the text bold
    textTransform: 'uppercase', // Make text uppercase
    letterSpacing: '1.5px', // Add spacing between letters
    borderBottom: '2px solid #FF6384', // Add an underline effect
    paddingBottom: '10px', // Space between text and underline
    width: 'fit-content', // Fit content width
    marginInline: 'auto' ,
    // Center horizontally
  }}>EDIT ORDER</h2>
              <form>
                <label>Customer Name</label>
                <input
                  type="text"
                  value={editingOrder.customer_name || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                />
                <label>Phone Number</label>
                <input
                  type="text"
                  value={editingOrder.phone_num || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, phone_num: e.target.value })}
                />
                <h2 style={{
    fontSize: '25px', // Adjust font size
    color: '#333', // Dark gray color
    textAlign: 'center', // Center align text
    margin: '20px 0', // Add space above and below
    fontWeight: 'bold', // Make the text bold
    textTransform: 'uppercase', // Make text uppercase
    letterSpacing: '1.5px', // Add spacing between letters
    borderBottom: '2px solid #FF6384', // Add an underline effect
    paddingBottom: '10px', // Space between text and underline
    width: 'fit-content', // Fit content width
    marginInline: 'auto' ,
    // Center horizontally
  }}>Products</h2>
                {editingOrder.products.length > 0 && (
  <table className="product-table">
    <thead>
      <tr>
        <th>Product Name</th>
        <th>Quantity</th>
        <th>Price per Unit</th>
        <th>Total Price</th>
      </tr>
    </thead>
    <tbody>
      {editingOrder.products.map(product => (
        <tr key={product.product_id}>
          <td>{product.product_name}</td>
          <td>
            <input
              type="number"
              value={product.quantity}
              onChange={(e) => handleProductQuantityChange(product.product_id, parseInt(e.target.value))}
              min="0"
            />
          </td>
          
          <td>₹{product.price_per_unit}</td>
          <td>₹{(product.price_per_unit * product.quantity).toFixed(2)}</td>
        </tr>
      ))}
    </tbody>
  </table>
)}
  <div style={{ marginTop: "50px" ,display:"flex", alignItemsItem:"center" , justifyContent:"center" }}>
                <button type="button" className="add-pay" style={{width:"80px"}} onClick={handlePay} >Pay
                </button>
  <button 
    type="button" 
    className="add-save"  
    onClick={handleSave} 
    style={{
      padding: '10px 20px',
      fontSize: '1rem',
      borderRadius: '5px',
      backgroundColor: '#4CAF50', 
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      margin: '0 10px',
      transition: 'background-color 0.3s ease'
    }}
  >
    Save
  </button>
  <button 
    type="button"  
    className="add-print" 
    onClick={handlePrint} 
    style={{
      padding: '10px 20px',
      fontSize: '1rem',
      borderRadius: '5px',
      backgroundColor: '#2196F3', 
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      margin: '0 10px',
      transition: 'background-color 0.3s ease'
    }}
  >
    <MdOutlinePrint />
  </button>
  <button 
    type="button" 
    className="add-cancel" 
    onClick={handleCancel} 
    style={{
      padding: '10px 20px',
      fontSize: '1rem',
      borderRadius: '5px',
      backgroundColor: '#f44336', 
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      margin: '0 10px',
      transition: 'background-color 0.3s ease'
    }}
  >
    Cancel
  </button>
</div>

              </form>
            </div>
            </div>
          )}
       
        </div>
      </div>
    </>
  );
};

export default Orders;
