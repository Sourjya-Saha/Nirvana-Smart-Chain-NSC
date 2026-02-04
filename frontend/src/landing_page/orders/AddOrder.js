import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../user_login/AuthContext';
import Sidebar from '../Sidebar';
import './AddOrder.css';

const AddOrder = () => {
  const navigate = useNavigate();
    const location = useLocation();
  const { userId } = useAuth();
  
  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    dateTime: new Date().toISOString().slice(0, 16),
    paymentMethod: 'online',
    status: 'unpaid'
  });

  const [products, setProducts] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
   const [errorMessage, setErrorMessage] = useState('');
  const [orderSummary, setOrderSummary] = useState({
    subTotal: 0,
    convenienceFee: 50,
    deliveryCharge: 100,
    total: 0
  });
  // Handle cart items from warehouse
  useEffect(() => {
    if (location.state?.cartItems) {
      const formattedCartItems = location.state.cartItems.map(item => ({
        product_id: item.product_id,
        name: item.name,
        price_per_unit: item.price_per_unit,
        quantity: item.quantity,
        totalPrice: item.price_per_unit * item.quantity
      }));
      setCartItems(formattedCartItems);
    }
    if (location.state?.orderSummary) {
      setOrderSummary(location.state.orderSummary);
    }
  }, [location.state]);
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/getProducts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId })
        });
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        setError('Failed to load products. Please try again.');
      }
    };

    fetchProducts();
  }, [userId]);
  const checkStockAvailability = async () => {
    try {
      // Fetch latest product data
      const response = await fetch('http://127.0.0.1:5000/getProducts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) throw new Error('Failed to check stock');
      const currentProducts = await response.json();
      
      // Check each cart item against current product stock
      const outOfStockItems = cartItems.filter(cartItem => {
        const product = currentProducts.find(p => p.product_id === cartItem.product_id);
        return !product || product.quantity_of_uom < cartItem.quantity_of_uom;
      });

      if (outOfStockItems.length > 0) {
        const outOfStockNames = outOfStockItems.map(item => item.name).join(', ');
        throw new Error(`The following items are out of stock: ${outOfStockNames}`);
      }
       
      return true;
    } catch (error) {
      throw error;
    }
  };





  useEffect(() => {
    const loadRazorpayScript = () => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    };
    loadRazorpayScript();
    fetchProducts();
  }, []);

  useEffect(() => {
    const subTotal = cartItems.reduce((total, item) => total + (item.price_per_unit * item.quantity), 0);
    setOrderSummary({
      subTotal,
      convenienceFee: 50,
      deliveryCharge: 100,
      total: subTotal + 50 + 100
    });
  }, [cartItems]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/getProducts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      console.log(data)
      setProducts(data);
    } catch (error) {
      setError('Failed to load products. Please try again.');
    }
  };
  useEffect(() => {
    const subTotal = cartItems.reduce((total, item) => total + (item.price_per_unit * item.quantity), 0);
    setOrderSummary({
      subTotal,
      convenienceFee: 50,
      deliveryCharge: 100,
      total: subTotal + 50 + 100
    });
  }, [cartItems]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleQuantityChange = (productId, newQuantity) => {
    setCartItems(prev => prev.map(item => {
      if (item.product_id === productId) {
        const quantity = Math.max(1, parseInt(newQuantity));
        return {
          ...item,
          quantity,
          totalPrice: item.price_per_unit * quantity
        };
      }
      return item;
    }));
  };

  const handleProductChange = (e) => {
    const productId = e.target.value;
    const selected = products.find(p => p.product_id === parseInt(productId));
    setSelectedProduct(selected || '');
  };

  const handleAddProduct = () => {
    if (!selectedProduct) return;

    const existingItem = cartItems.find(item => item.product_id === selectedProduct.product_id);

    if (existingItem) {
      setCartItems(prev => prev.map(item => 
        item.product_id === selectedProduct.product_id
          ? {
              ...item,
              quantity: item.quantity + 1,
              totalPrice: (item.quantity + 1) * item.price_per_unit
            }
          : item
      ));
    } else {
      const newItem = {
        product_id: selectedProduct.product_id,
        name: selectedProduct.name,
        price_per_unit: selectedProduct.price_per_unit,
        quantity: 1,
        totalPrice: selectedProduct.price_per_unit
      };
      setCartItems(prev => [...prev, newItem]);
    }

    setSelectedProduct('');
  };


  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const exists = prev.find(item => item.product_id === product.product_id);
      if (exists) {
        return prev.map(item =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };


  const handleRemoveFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.product_id !== productId));
  };


  const updateOrderStatus = async (orderId) => {
    try {
      const response = await fetch('http://127.0.0.1:5000/update_order_status_website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }) // Make sure to use order_id as the key
      });
      
      if (!response.ok) {
        throw new Error('Failed to update order status');
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setErrorMessage('');

    if (cartItems.length === 0) {
      setError('Please add items to cart before proceeding');
      setIsLoading(false);
      return;
    }

    try {

      await checkStockAvailability();
      const orderResponse = await fetch('http://127.0.0.1:5000/create_razorpay_order_website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: {
            customer_name: formData.customerName,
            phone_num: formData.phoneNumber,
            date_time: formData.dateTime,
            payment_method: formData.paymentMethod,
            status: formData.status,
            order_details: cartItems.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity
            }))
          },
          user_id: userId
        })
      });

      if (!orderResponse.ok) throw new Error('Failed to create order');
      const orderData = await orderResponse.json();

      const options = {
        key: 'rzp_test_2EpPSCTb8XHFCk',
        amount: orderData.total_amount * 100,
        currency: 'INR',
        name: 'Maa Tara Store',
        description: 'Medicine Order Payment',
        order_id: orderData.razorpay_order_id,
        handler: async function(response) {
          try {
            const verifyResponse = await fetch('http://127.0.0.1:5000/confirm_order_payment_website', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                temp_order_data: orderData.temp_order_data
              })
            });

            if (!verifyResponse.ok) throw new Error('Payment verification failed');
            
            const verifyResult = await verifyResponse.json();
            
            // Pass the correct order_id to updateOrderStatus
            await updateOrderStatus(verifyResult.order_id);
            
            alert('Order placed successfully!');
            navigate('/orders');
          } catch (error) {
            setError('Payment verification failed. Please try again.');
          }
        },
        prefill: {
          name: formData.customerName,
          contact: formData.phoneNumber
        },
        theme: {
          color: '#28a745'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      setError(error.message || 'Payment failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dash-board">
      <Sidebar />
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
          marginInline: 'auto'
        }}>Place your order</h2>

        {error && (
          <div style={{
            color: 'red',
            fontWeight: 'bold',
            margin: '10px 0',
            padding: '10px',
            border: '1px solid red',
            borderRadius: '5px',
            backgroundColor: '#ffe6e6'
          }}>
            {error}
          </div>
        )}
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

        <form onSubmit={handlePayment} className="add-order-form">
          <div className="form-group">
            <label htmlFor="customerName">Customer Name:</label>
            <input
              type="text"
              id="customerName"
              name="customerName"
              value={formData.customerName}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Customer Phone Number:</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="dateTime">Date and Time:</label>
            <input
              type="datetime-local"
              id="dateTime"
              name="dateTime"
              value={formData.dateTime}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="product">Select Product:</label>
            <select
              id="product"
              value={selectedProduct ? selectedProduct.product_id : ''}
              onChange={handleProductChange}
              className="w-full p-2 border rounded"
            >
              <option value="">Select a product</option>
              {products.map(product => (
                <option key={product.product_id} value={product.product_id}>
                  {product.name} - ₹{product.price_per_unit}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddProduct}
            disabled={!selectedProduct}
            style={{
              backgroundColor: "#007bff", // Blue background
              color: "#fff", // White text
              padding: "10px 20px",
              fontSize: "16px",
              fontWeight: "bold",
              borderRadius: "5px",
              border: "none", // Removes the default border
              cursor: "pointer",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", // Subtle shadow for depth
              transition: "background-color 0.3s ease" // Smooth hover effect
            }}
          >
            Add Product
          </button>
         

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
              {cartItems.map((item) => (
                  <tr key={item.product_id}>
                    <td className="border p-2">{item.name}</td>
                    <td className="border p-2">₹{item.price_per_unit}</td>
                    <td className="border p-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.product_id, e.target.value)}
                        className="w-20 p-1 border rounded"
                      />
                    </td>
                    <td className="border p-2">₹{item.totalPrice.toFixed(2)}</td>
                    <td className="border p-2">
                    <button 
                        type="button" 
                        className="close-button" 
                        style={{padding:"8px", marginTop:"0px"}}
                        onClick={() => handleRemoveFromCart(item.product_id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="overall-total">
              <h3 className="total-price" style={{
                color: "#28a745",
                fontWeight: "600",
                marginLeft: "8px",
              }}>
                <span style={{
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                  color: "#333",
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                }}>Total:</span> 
                ₹ {orderSummary.total.toFixed(2)}
              </h3>
            </div>
          </div>

          <div className="form-actions" style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            marginTop: "20px"
          }}>
            <button
              type="submit"
              disabled={isLoading || cartItems.length === 0}
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
              {isLoading ? 'Processing...' : 'Proceed to Payment'}
            </button>
            
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOrder;