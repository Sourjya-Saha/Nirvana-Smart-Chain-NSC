import React, { useState, useEffect } from 'react';
import { useAuth } from '../user_login/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import Sidebar from '../Sidebar';
import { useLocation } from 'react-router-dom';
import SideWhole from '../SideWhole';

const AddTransactionWhole = () => {
  const { userId } = useAuth();
  const location = useLocation();
  const { cart, preSelectedManufacturer, preSelectedProduct } = location.state || {};

  const [order, setOrder] = useState({
    customerName: '',
    customerAddress: '',
    customerPhoneNumber: '',
    dateTime: new Date().toISOString().slice(0, 16),
    products: [{ product: '', quantity: 1, rate: 0, totalPrice: 0 }],
    status: 'unpaid',
    manufacturerId: '', 
    manufacturerName: '', 
  });

  const [productsData, setProductsData] = useState([]);
  const [manufacturersList, setManufacturersList] = useState({});
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch manufacturer users on component mount
  useEffect(() => {
    const fetchManufacturers = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/get_manufacturer_users');
        const data = await response.json();
        console.log("ManuData" , data)
        setManufacturersList(data);
        if (preSelectedManufacturer) {
            setOrder(prevOrder => ({
              ...prevOrder,
              manufacturerName: preSelectedManufacturer.name,
              manufacturerId: preSelectedManufacturer.id,
            }));
          }
      } catch (error) {
        console.error('Error fetching manufacturers:', error);
      }
    };

    fetchManufacturers();
  }, [preSelectedManufacturer]);

  // Fetch retailer name automatically
  useEffect(() => {
    const fetchRetailerName = async () => {
      if (!userId) return;

      try {
        const response = await fetch('http://127.0.0.1:5000/get_name_of_wholesaler_by_user_id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId }),
        });
        const data = await response.json();
        setOrder(prevOrder => ({
          ...prevOrder,
          customerName: data.user_id || '', 
        }));
      } catch (error) {
        console.error('Error fetching retailer name:', error);
      }
    };

    fetchRetailerName();
  }, [userId]);

  // Fetch products based on selected manufacturer
  useEffect(() => {
    const fetchProducts = async () => {
      if (!order.manufacturerId) return;

      try {
        const response = await fetch('http://127.0.0.1:5000/getProductsManu', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: order.manufacturerId }),
        });
        const data = await response.json();
        setProductsData(data);
        if (preSelectedProduct) {
            const selectedProduct = data.find(p => p.name === preSelectedProduct.name);
            if (selectedProduct) {
              setOrder(prevOrder => ({
                ...prevOrder,
                products: [{
                  product: selectedProduct.name,
                  quantity: 1,
                  rate: selectedProduct.price_per_unit,
                  totalPrice: selectedProduct.price_per_unit,
                  product_id: selectedProduct.product_id
                }]
              }));
            }
          }
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, [order.manufacturerId , preSelectedProduct]);

  useEffect(() => {
    if (cart && cart.length > 0) {
      setOrder(prevOrder => ({
        ...prevOrder,
        products: cart.map(item => ({
          product: item.name,
          quantity: item.quantity,
          rate: item.price_per_unit,
          totalPrice: item.price_per_unit * item.quantity,
          product_id: item.product_id
        })),
      }));
    }
  }, [cart]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setOrder({ ...order, [name]: value });
  };

  const handleManufacturerChange = (e) => {
    const selectedManufacturerName = e.target.value;
    
    const manufacturerEntry = Object.entries(manufacturersList).find(
      ([manufacturerName]) => manufacturerName === selectedManufacturerName
    );

    if (manufacturerEntry) {
      const [name, userId] = manufacturerEntry;
      setOrder(prevOrder => ({
        ...prevOrder,
        manufacturerName: name,
        manufacturerId: userId,
        products: [{ product: '', quantity: 1, rate: 0, totalPrice: 0 }]
      }));
    }
  };

  const handleProductChange = (e, index) => {
    const selectedProductName = e.target.value;
    const selectedProduct = productsData.find((product) => product.name === selectedProductName);
    
    const updatedProducts = [...order.products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      product: selectedProduct ? selectedProduct.name : '',
      rate: selectedProduct ? selectedProduct.price_per_unit : 0,
      product_id: selectedProduct ? selectedProduct.product_id : null,
      totalPrice: selectedProduct ? selectedProduct.price_per_unit * updatedProducts[index].quantity : 0,
    };
    
    setOrder({ ...order, products: updatedProducts });
  };

  const handleQuantityChange = (e, index) => {
    const quantity = parseInt(e.target.value, 10);
    const updatedProducts = [...order.products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      quantity,
      totalPrice: updatedProducts[index].rate * quantity,
    };
    setOrder({ ...order, products: updatedProducts });
  };

  const handleAddProduct = () => {
    setOrder({
      ...order,
      products: [...order.products, { product: '', quantity: 1, rate: 0, totalPrice: 0 }],
    });
  };

  const handleRemoveProduct = (index) => {
    const updatedProducts = [...order.products];
    updatedProducts.splice(index, 1);
    setOrder({ ...order, products: updatedProducts });
  };

  const calculateOverallTotal = () => {
    return order.products.reduce((sum, product) => sum + product.totalPrice, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const overallTotalPrice = calculateOverallTotal();

    const newOrder = {
      user_id: userId,
      customer_name: order.customerName,
      phone_num: order.customerPhoneNumber,
      date_time: order.dateTime,
      status: order.status,
      manu_id: order.manufacturerId,
      order_details: order.products.map((product) => ({
        product_id: product.product_id,
        quantity: product.quantity,
      })).filter(item => item.product_id !== null),
    };

    try {
      const response = await fetch('http://127.0.0.1:5000/insert_transaction_whole_to_manu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrorMessage(errorData.error || 'Error creating order. Please try again.');
        console.error('Error creating order:', errorData.error);
      } else {
        setErrorMessage('');
        const data = await response.json();
        console.log('Order created successfully:', data);
        
        // Reset form after successful submission
        setOrder({
          customerName: '',
          customerAddress: '',
          customerPhoneNumber: '',
          dateTime: new Date().toISOString().slice(0, 16),
          products: [{ product: '', quantity: 1, rate: 0, totalPrice: 0 }],
          status: 'unpaid',
          manufacturerId: '',
          manufacturerName: '',
        });
      }
    } catch (error) {
      setErrorMessage('Error submitting order. Please try again.');
      console.error('Error submitting order:', error);
    }
  };

  const handlePrint = async () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Customer Details", 20, 20);
    doc.setFontSize(12);
    doc.text(`Name: ${order.customerName}`, 20, 30);
    doc.text(`Address: ${order.customerAddress}`, 20, 40);
    doc.text(`Phone Number: ${order.customerPhoneNumber}`, 20, 50);
    doc.text(`Date and Time: ${new Date(order.dateTime).toLocaleString()}`, 20, 60);

    doc.setFontSize(16);
    doc.text("Scan your QR", 140, 20);
    const qrCodeData = `Order Details:\nName: ${order.customerName}\nAddress: ${order.customerAddress}\nPhone: ${order.customerPhoneNumber}\nStatus: ${order.status}`;
    try {
      const qrCodeUrl = await QRCode.toDataURL(qrCodeData, { width: 40, height: 40 });
      doc.addImage(qrCodeUrl, 'PNG', 138, 22, 40, 40);
    } catch (err) {
      console.error('Error generating QR code:', err);
    }

    const overallTotalPrice = calculateOverallTotal();

    doc.text("Ordered Products", 20, 80);
    doc.autoTable({
      startY: 86,
      head: [['Product', 'Rate', 'Quantity', 'Total Price']],
      body: order.products.map(product => [
        product.product,
        `Rs. ${product.rate.toFixed(2)}`,
        product.quantity,
        `Rs. ${product.totalPrice.toFixed(2)}`,
      ]),
      theme: 'striped'
    });

    doc.setFontSize(14);
    doc.text(`Total Bill: Rs. ${overallTotalPrice.toFixed(2)}`, 20, doc.autoTable.previous.finalY + 10);
    doc.text(`Status: ${order.status}`, 20, doc.autoTable.previous.finalY + 20);
    doc.save('order-details.pdf');
  };

  return (
    <div className='dash-board'>
      <SideWhole />
      <div className="add-order-container">
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
        }}>
          Order your shipment
        </h2>

        {errorMessage && (
          <div style={{
            color: 'red',
            fontWeight: 'bold',
            margin: '10px 0',
            padding: '10px',
            border: '1px solid red',
            borderRadius: '5px',
            backgroundColor: '#ffe6e6'
          }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="add-order-form">
          <div className="form-group">
            <label htmlFor="manufacturerName">Select Manufacturer:</label>
            <select
              id="manufacturerName"
              name="manufacturerName"
              value={order.manufacturerName}
              onChange={handleManufacturerChange}
              required
            >
              <option value="">Select Manufacturer</option>
              {Object.keys(manufacturersList).map((manufacturerName) => (
                <option key={manufacturerName} value={manufacturerName}>
                  {manufacturerName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="customerName">Your Name:</label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={order.customerName}
              onChange={handleChange}
              required
              readOnly
            />
          </div>

          {/* <div className="form-group">
            <label htmlFor="customerAddress">Customer Address:</label>
            <input
              type="text"
              id="customerAddress"
              name="customerAddress"
              value={order.customerAddress}
              onChange={handleChange}
              required
            />
          </div> */}

          <div className="form-group">
            <label htmlFor="customerPhoneNumber">Your Phone Number:</label>
            <input
              type="text"
              id="customerPhoneNumber"
              name="customerPhoneNumber"
              value={order.customerPhoneNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="dateTime">Date and Time:</label>
            <input
              type="datetime-local"
              id="dateTime"
              name="dateTime"
              value={order.dateTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Payment Status:</label>
            <select
              id="status"
              name="status"
              value={order.status}
              onChange={handleChange}
              required
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="products-table">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Rate</th>
                  <th>Quantity</th>
                  <th>Total Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {order.products.map((productOrder, index) => (
                  <tr key={index}>
                    <td>
                      <select
                        value={productOrder.product}
                        onChange={(e) => handleProductChange(e, index)}
                        required
                        disabled={!order.manufacturerId}
                      >
                        <option value="">
                          {!order.manufacturerId 
                            ? "Select a Manufacturer First" 
                            : "Select Product"}
                        </option>
                        {productsData.map(product => (
                          <option key={product.product_id} value={product.name}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>₹ {productOrder.rate}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={productOrder.quantity}
                        onChange={(e) => handleQuantityChange(e, index)}
                        required
                      />
                    </td>
                    <td>₹ {productOrder.totalPrice}</td>
                    <td>
                      <button 
                        type="button" 
                        className='close-button' 
                        style={{padding:"8px", marginTop:"0px"}} 
                        onClick={() => handleRemoveProduct(index)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="overall-total">
              <h3 className='total-price' style={{
                color: "#28a745",
                fontWeight: "600",
                marginLeft: "8px",
              }}>
                <span style={{ 
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                  color: "#333",
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px'
                }}>
                  Total:
                </span> 
                ₹ {calculateOverallTotal()}
              </h3>
            </div>
          </div>

          {/* Action Buttons remain the same */}
          <div 
            className="form-actions" 
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "20px",
              marginTop: "20px"
            }}
          >
            <button 
              type="button" 
              className="button-add-product" 
              onClick={handleAddProduct}
              style={{
                backgroundColor: "#007bff",
                color: "#fff",
                padding: "10px 20px",
                fontSize: "16px",
                fontWeight: "bold",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                transition: "background-color 0.3s ease"
              }}
            >
              Add Product
            </button>

            <button 
              type="submit" 
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                fontWeight: "bold",
                borderRadius: "5px",
                border: "1px solid #28a745",
                backgroundColor: "#28a745",
                color: "#fff",
                cursor: "pointer",
                minWidth: "150px"
              }}
            >
              Submit Order
            </button>
  
            <button 
              type="button" 
              onClick={handlePrint}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                fontWeight: "bold",
                borderRadius: "5px",
                border: "1px solid #28a745",
                backgroundColor: "#fff",
                color: "#28a745",
                cursor: "pointer",
                minWidth: "150px",
              }}
            >
              Print Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionWhole;