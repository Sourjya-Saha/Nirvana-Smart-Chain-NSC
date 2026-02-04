import React, { useState, useEffect } from "react";
import axios from "axios";
import "./carts.css";
import SideManu from "../SideManu";
import Modal from 'react-modal';
import { useAuth } from "../user_login/AuthContext";
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer, toast } from 'react-toastify';

Modal.setAppElement('#root');


const Cart = () => {
  const { userId } = useAuth(); 
  const [products, setProducts] = useState([
    { product_id: "", quantity: 1, price_per_unit: 0 },
  ]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [cartData, setCartData] = useState([]);
  const [selectedCart, setSelectedCart] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cartId, setCartId] = useState("");
  const [usedCartIds, setUsedCartIds] = useState(new Set());
  const [formData, setFormData] = useState({
    cart_id: '',
    receivers_addressM: '', // Added manufacturer address
    receivers_addressW: '',
    receivers_addressR: '',
    date: '',
});


  const [qrImage, setQrImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false); // Modal state
  const [error, setError] = useState(''); // Add state for error messages



  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Check if there are any duplicate non-empty addresses
    const addresses = [
        formData.receivers_addressM, 
        formData.receivers_addressW, 
        formData.receivers_addressR
    ].filter(addr => addr && addr.trim() !== ''); // Only consider non-empty addresses

    const hasDuplicates = addresses.some((addr, index) => 
        addr && addresses.slice(0, index).concat(addresses.slice(index + 1)).includes(addr)
    );

    if (hasDuplicates) {
        setError('Error: Each provided address must be unique. Different addresses are required for filled fields.');
        return;
    }

    setLoading(true);

    try {
        const response = await axios.post('http://localhost:5000/generate_qr', {
            ...formData,
            // If address is empty or only whitespace, send null instead
            receivers_addressM: formData.receivers_addressM?.trim() || null,
            receivers_addressW: formData.receivers_addressW?.trim() || null,
            receivers_addressR: formData.receivers_addressR?.trim() || null
        }, {
            responseType: 'blob'
        });

        if (response.status === 200) {
            const imageUrl = URL.createObjectURL(new Blob([response.data], { type: 'image/png' }));
            setQrImage(imageUrl);
            setModalIsOpen(false);
        } else {
            setError('Unexpected response from the server.');
        }
    } catch (error) {
        console.error('Error generating QR code:', error);
        setError('An error occurred while generating QR code. Please try again.');
    } finally {
        setLoading(false);
    }
};

  // Open the modal
  const openModal = async (cartId) => {
    // Find the selected cart to get its products and their prices
    const selectedCart = cartData.find(cart => cart.cart_id === cartId);
    if (selectedCart) {
        const totalPricePerUnit = selectedCart.products.reduce((total, product) => {
            return total + (product.price_per_unit * product.quantity);
        }, 0);

        setFormData(prevState => ({
            ...prevState,
            cart_id: cartId,
            price_per_unit: String(totalPricePerUnit),
        }));

        // Fetch addresses from the API
        try {
            const response = await axios.post('http://localhost:5000/get_meta_add_for_qr', {
                cart_id: cartId
            });

            // Update form data with fetched addresses
            setFormData(prevState => ({
                ...prevState,
                receivers_addressM: response.data.manufacturer || '',
                receivers_addressW: response.data.wholesaler || '',
                receivers_addressR: response.data.retailer || ''
            }));
        } catch (error) {
            console.error('Error fetching addresses:', error);
            toast.error('Failed to fetch addresses');
        }
    }
    setModalIsOpen(true);
};

  // Close the modal
  const closeModal = () => {
    setModalIsOpen(false);
  };

  

  const generateRandomCartId = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    const generateRandomString = (length) => {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    };
  
    let newCartId;
    do {
      // Generate a random alphanumeric string of 9-10 characters
      newCartId = generateRandomString(Math.floor(Math.random() * 2) + 9);
    } while (usedCartIds.has(newCartId));
  
    // Update the set of used cart IDs
    setUsedCartIds((prev) => new Set(prev).add(newCartId));
    
    // Set the new cart ID
    setCartId(newCartId);
  
    return newCartId;
  };

  useEffect(() => {
    if (userId) {
      axios
        .post('http://localhost:5000/getProductsManu', {
          user_id: userId, // Send userId in the request body
        })
        .then((response) => {
          setAvailableProducts(response.data);
        })
        .catch((error) => {
          console.error("Error fetching products:", error);
        });
  
      fetchCartData();
    }
  }, [userId]);
  

  const fetchCartData = async () => {
    try {
      const response = await axios.post('http://localhost:5000/getCartsManu', {
        user_id: userId, // Send userId in the request body
      });
  
      setCartData(response.data); // Store the fetched cart data in state
      console.log(response.data);
    } catch (error) {
      console.error("Error fetching cart data:", error);
    }
  };
  
  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`http://localhost:5000/deleteCartManu/${id}`, {
        params: { user_id: userId }, // Pass userId to authorize delete
      });
      if (response.status === 200 && response.data.success) {
        const newCarts = cartData.filter((cart) => cart.cart_id !== id);
        setCartData(newCarts);
        console.log(`Cart with ID ${id} deleted successfully`);
        toast.success(`Cart ${id} deleted successfully`);
      } else {
        console.error('Failed to delete Cart');
        toast.error('Failed to delete Cart');
      }
    } catch (err) {
      console.error("Something went wrong while deleting the cart", err);
      toast.error(`Failed to delete Cart ${id}`);
    }
  };
  

  const handleAddProduct = () => {
    setProducts([...products, { product_id: "", quantity: 1, price_per_unit: 0 }]);
  };

  const handleRemoveProduct = (index) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleProductChange = (index, field, value) => {
    const newProducts = [...products];

    // Set the price per unit based on the selected product
    if (field === "product_id") {
      const selectedProduct = availableProducts.find((p) => p.product_id === value);
      newProducts[index] = {
        ...newProducts[index],
        product_id: value,
        price_per_unit: selectedProduct ? selectedProduct.price_per_unit : 0,
      };
    } else {
      newProducts[index][field] = value;
    }

    setProducts(newProducts);
  };

  // Add cart to the server

  const [cartError, setCartError] = useState('');
const handleAddCart = () => {
  // Create a new array without price_per_unit
  setCartError('');
  const cartExists = cartData.some(cart => cart.cart_id === cartId);
  if (cartExists) {
    // Set an error message if cart ID already exists
    toast.error(`Cart with ID ${cartId} already exists. Please use a different Cart ID.`);
    setCartError(`Cart with ID ${cartId} already exists. Please use a different Cart ID.`);
    return; // Stop the function execution
  }
  const productsToSend = products.map(({ product_id, quantity }) => ({
    product_id,
    quantity,
  }));

  axios.post("http://localhost:5000/add_to_cart", {
    cart_id: cartId,
    products: productsToSend, // Use the new array without price_per_unit
    user_id: userId, // Pass userId from AuthContext
  })
  .then(() => {
    toast.success(`Cart ${cartId} added successfully!`);
    fetchCartData();
  })
  .catch((error) => {
    console.error("Error adding cart:", error);
    toast.error("Failed to add cart. Please try again.");
  });
};

  

const handleViewCart = async (id) => {
  try {
    const response = await axios.post(`http://localhost:5000/get_cart/${id}`, {
      user_id: userId, // Pass userId in the request body
    });

    // Assuming the API returns the data in the expected format
    setSelectedCart(response.data); // Set the selected cart with the response data
    setModalVisible(true); // Open the modal to show cart details
  } catch (error) {
    console.error("Error viewing cart:", error); // Log any errors
  }
};

  const closeModl = () => {
    setModalVisible(false);
    setSelectedCart(null);
  };

  const calculateTotals = (cart) => {
    const totalQuantity = cart.products.reduce((sum, p) => sum + p.quantity, 0);
    const totalPrice = cart.products.reduce((sum, p) => sum + p.quantity * p.price_per_unit, 0);
    return { totalQuantity, totalPrice };
  };

  const buttonStyle = {
    backgroundColor: "#007BFF",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "16px",
    transition: "background-color 0.3s",
    marginLeft: "6px",
  };

  const buttonHoverStyle = {
    backgroundColor: "#0056b3",
  };
  const downloadQrCode = () => {
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = 'QRCode.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <>
      <SideManu />
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <div className="dash-board">
        <div className="cart-management-container">
        <h2 style={{
    fontSize: '26px', // Adjust font size
    color: '#333', // Dark gray color
    textAlign: 'center', // Center align text
    margin: '20px 0', // Add space above and below
    fontWeight: 'bold', // Make the text bold
    textTransform: 'uppercase', // Make text uppercase
    letterSpacing: '1.5px', // Add spacing between letters
    borderBottom: '2px solid #FF6384', // Add an underline effect
    paddingBottom: '10px', // Space between text and underline
    width: 'fit-content', // Fit content width
    marginInline: 'auto' // Center horizontally
  }}>CART management</h2>

          <div className="cart-management-form" style={{
  backgroundColor: '#f9fafb',
  padding: '30px',
  borderRadius: '12px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  width: '100%',
  margin: '0 auto',
  fontFamily: 'Poppins'
}}>
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent:"center",
    marginBottom: '20px'
  }}>
    <label 
      className="cart-id-label" 
      style={{
        fontWeight: '600',
        marginRight: '15px',
        color: '#333',
        fontSize: '16px'
      }}
    >
      Cart ID:
    </label>
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      width: '90%',
      gap: '20px'
    }}>
      <input
        className="cart-id-input"
        style={{
          flex: 1,
          padding: '10px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          fontSize: '14px',
          transition: 'all 0.3s ease',
          width:"80%",
          outline: 'none',
          ':focus': {
            borderColor: '#3b82f6',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)'
          }
        }}
        type="text"
        value={cartId}
        onChange={(e) => setCartId(e.target.value)}
        placeholder="Enter cart ID"
        readOnly
      />
      <button
        style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 15px',
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          ':hover': {
            backgroundColor: '#2563eb',
            transform: 'translateY(-2px)'
          }
        }}
        onClick={generateRandomCartId}
      >
        <span>Generate ID</span>
      </button>
    </div>
  </div>

  {cartError && (
    <div 
      style={{
        backgroundColor: '#fee2e2',
        color: '#b91c1c',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #fecaca',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}
    >
      <i className="fa-solid fa-exclamation-circle" style={{color: '#b91c1c'}}></i>
      {cartError}
    </div>
  )}

  <h3 style={{
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '15px',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '10px'
  }}>
    Add Products
  </h3>

  {products.map((product, index) => {
    // Ensure that availableProducts is loaded
    if (!availableProducts.length) {
      return null;
    }

    const selectedProduct = availableProducts.find(p => String(p.product_id) === String(product.product_id));
    const pricePerUnit = selectedProduct ? selectedProduct.price_per_unit : 0;
    const totalPrice = pricePerUnit * product.quantity;

    return (
      <div 
        key={index} 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          marginBottom: '15px',
          border: '1px solid #e5e7eb'
        }}
      >
        <select
          style={{
            flex: 2,
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            fontSize: '14px'
          }}
          value={product.product_id}
          onChange={(e) => handleProductChange(index, "product_id", e.target.value)}
          disabled
        >
          <option value="">Select Product</option>
          {availableProducts.map((p) => (
            <option key={p.product_id} value={p.product_id}>
              {p.name} - ₹{p.price_per_unit}
            </option>
          ))}
        </select>

        <input
          style={{
            width: '80px',
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            textAlign: 'center'
          }}
          type="number"
          value={product.quantity}
          onChange={(e) => handleProductChange(index, "quantity", e.target.value)}
          min="1"
        />

        <button
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={() => handleRemoveProduct(index)}
        >
          <i className="fa-solid fa-trash"></i>
        </button>

        <p style={{
          marginLeft: 'auto',
          fontWeight: '600',
          color: '#374151'
        }}>
          Total Price: ₹{totalPrice.toFixed(2)}
        </p>
      </div>
    );
  })}

  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px'
  }}>
    <button 
      style={{
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s ease',
        ':hover': {
          backgroundColor: '#059669'
        }
      }}
      onClick={handleAddProduct}
    >
      <i className="fa-solid fa-plus"></i>
      Add Another Product
    </button>

    <button 
      style={{
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        padding: '12px 20px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s ease',
        ':hover': {
          backgroundColor: '#2563eb'
        }
      }}
      onClick={handleAddCart}
    >
      <i className="fa-solid fa-cart-plus"></i>
      Add Cart
    </button>
  </div>
</div>
          <div >

          {cartData.map((cart) => (
    <div key={cart.cart_id} style={{ marginTop: "10px" }} className="cart-item">
        <span style={{ fontFamily: "Poppins", fontWeight: "600" }}>Cart ID: {cart.cart_id}</span>
        <button className="generate_qr" onClick={() => openModal(cart.cart_id)}>Generate QR</button>
        {/* Display additional cart details if needed */}
    </div>
))}



 <div className="">
 <div className="">
  <Modal isOpen={modalIsOpen} onRequestClose={closeModal} className="genqr" >
  <h2 style={{
    fontSize: '26px', // Adjust font size
    color: '#333', // Dark gray color
    textAlign: 'center', // Center align text
    margin: '20px 0', // Add space above and below
    fontWeight: 'bold', // Make the text bold
    textTransform: 'uppercase', // Make text uppercase
    letterSpacing: '1.5px', // Add spacing between letters
    borderBottom: '2px solid #FF6384', // Add an underline effect
    paddingBottom: '10px', // Space between text and underline
    width: 'fit-content', // Fit content width
    marginInline: 'auto', // Center horizontally
    fontFamily:'Poppins'
  }}>generate QR CODE</h2>
   
    {error && (
      <div 
        style={{
          color: 'red', 
          marginBottom: '10px', 
          fontFamily: 'Poppins', 
          border: '1px solid red', 
          padding: '10px', 
          borderRadius: '5px'
        }}
      >
        {error}
      </div>
    )}

<form onSubmit={handleSubmit} className="grid-form">
    <label style={{fontFamily:"Poppins"}}>Cart ID:</label>
    <input
        type="text"
        name="cart_id"
        value={formData.cart_id}
        onChange={handleChange}
        placeholder="Cart ID"
        required
        readOnly
    />
    
    <label style={{fontFamily:"Poppins"}}>
        Manufacturer Wallet Address (Optional)
    </label>
    <input
        type="text"
        name="receivers_addressM"
        value={formData.receivers_addressM}
        onChange={handleChange}
        placeholder="Manufacturer's Address (Optional)"
        readOnly
    />

    <label style={{fontFamily:"Poppins"}}>
        Wholesaler Wallet Address (Optional)
    </label>
    <input
        type="text"
        name="receivers_addressW"
        value={formData.receivers_addressW}
        onChange={handleChange}
        placeholder="Wholesaler's Address (Optional)"
        readOnly
    />
    
    <label style={{fontFamily:"Poppins"}}>
        Retailer Wallet Address (Optional)
    </label>
    <input
        type="text"
        name="receivers_addressR"
        value={formData.receivers_addressR}
        onChange={handleChange}
        placeholder="Retailer's Address (Optional)"
        readOnly
        
    />
    
    <label style={{fontFamily:"Poppins"}}>Date</label>
    <input
        type="date"
        name="date"
        value={formData.date}
        onChange={handleChange}
        required
    />
   
    <button type="submit">Generate QR Code</button>
</form>
    <button onClick={closeModal}>Close</button>
  </Modal>
</div>
 

                {qrImage && (
  <div style={{ marginTop: '20px', textAlign: 'center' }}>
    <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Your QR Code:</h1>
    <img 
      src={qrImage} 
      alt="Generated QR Code" 
      style={{ 
        width: '200px',  // Adjusted smaller width for the QR code
        height: '200px', 
        border: '2px solid #4CAF50',  // Green border
        borderRadius: '8px',  // Rounded corners
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',  // Shadow for depth
        marginBottom: '10px' 
      }} 
    />
    <button 
      onClick={downloadQrCode} 
      style={{ 
        padding: '10px', 
        fontSize: '12px', 
        backgroundColor: '#4CAF50',  // Green background
        marginLeft:"20px",
        color: 'white',  // White text
        border: 'none', 
        borderRadius: '5px', 
        cursor: 'pointer', 
        transition: 'background-color 0.3s, transform 0.3s' 
      }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#45a049'} // Darker green on hover
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'} // Original green on mouse out
    >
      Download QR
    </button>
  </div>
)}

</div>
</div>

<h2 style={{
    fontSize: '26px', // Adjust font size
    color: '#333', // Dark gray color
    textAlign: 'center', // Center align text
    margin: '20px 0', // Add space above and below
    fontWeight: 'bold', // Make the text bold
    textTransform: 'uppercase', // Make text uppercase
    letterSpacing: '1.5px', // Add spacing between letters
    borderBottom: '2px solid #FF6384', // Add an underline effect
    paddingBottom: '10px', // Space between text and underline
    width: 'fit-content', // Fit content width
    marginInline: 'auto' // Center horizontally
  }}>cart list</h2>
          <table className="cart-list-table">
            <thead>
              <tr>
                <th>Cart ID</th>
                <th>Total Quantity</th>
                <th>Total Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cartData.map((cart) => {
                const totals = calculateTotals(cart);
                return (
                  <tr key={cart.cart_id}>
                    <td>{cart.cart_id}</td>
                    <td>{totals.totalQuantity}</td>
                    <td>₹{totals.totalPrice.toFixed(2)}</td>
                    <td>
                      <button
                        className="cart-view-btn"
                        onClick={() => handleViewCart(cart.cart_id)}
                      >
                       <i class="fa-solid fa-eye"></i>
                      </button>
                      <button
  className="action-button delete-button"
  onClick={() => handleDelete(cart.cart_id)}  // Use the correct product ID
>
  <i className="fa-solid fa-trash"></i>
 
</button>







                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {modalVisible && selectedCart && (
  <div 
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(56, 65, 84, 0.7)', // Modern, subtle backdrop
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      fontFamily: 'Poppins, sans-serif',
      backdropFilter: 'blur(5px)' // Adds a frosted glass effect
    }}
  >
    <div 
      style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: '30px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        transform: 'translateY(-20px)',
        animation: 'fadeInUp 0.4s ease-out forwards'
      }}
    >
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <span 
        onClick={closeModl}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          fontSize: '30px',
          cursor: 'pointer',
          color: '#6b7280',
          transition: 'all 0.3s ease',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          hover: {
            backgroundColor: '#f3f4f6',
            color: '#374151'
          }
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#f3f4f6';
          e.target.style.color = '#374151';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.color = '#6b7280';
        }}
      >
        &times;
      </span>

      <h2 style={{
    fontSize: '26px', // Adjust font size
    color: '#333', // Dark gray color
    textAlign: 'center', // Center align text
    margin: '20px 0', // Add space above and below
    fontWeight: 'bold', // Make the text bold
    textTransform: 'uppercase', // Make text uppercase
    letterSpacing: '1.5px', // Add spacing between letters
    borderBottom: '2px solid #FF6384', // Add an underline effect
    paddingBottom: '10px', // Space between text and underline
    width: 'fit-content', // Fit content width
    marginInline: 'auto' // Center horizontally
  }}>cart details</h2>

<div 
      style={{
        display: 'flex',
        gap: '20px',
        overflowX: 'auto',
        padding: '10px 5px',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin', // For Firefox browsers
        scrollbarColor: 'rgba(0, 0, 0, 0.5) transparent', // Thumb and track colors
      }}
    >
        {selectedCart.products && selectedCart.products.length > 0 ? (
          selectedCart.products.map((p, index) => (
            <div 
              key={index}
              style={{
                background: 'linear-gradient(145deg, #f9fafb, #ffffff)',
                borderRadius: '16px',
                padding: '25px',
                minWidth: '270px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
                transition: 'all 0.3s ease',
                scrollSnapAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'scale(1.03)';
                e.target.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.05)';
              }}
            >
              <h4 
                style={{
                  color: '#1f2937',
                  fontSize: '20px',
                  marginBottom: '15px',
                  fontWeight: 600,
                  borderBottom: '1px solid #e5e7eb',
                  paddingBottom: '10px'
                }}
              >
                {p[1] || 'N/A'}
              </h4>
              <div>
                <p 
                  style={{
                    color: '#4b5563',
                    margin: '8px 0',
                    fontSize: '15px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Quantity:</span>
                  <span style={{fontWeight: 600}}>{p[3] || 0}</span>
                </p>
                <p 
                  style={{
                    color: '#4b5563',
                    margin: '8px 0',
                    fontSize: '15px',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Price per Unit:</span>
                  <span style={{fontWeight: 600}}>₹{p[2] || 0}</span>
                </p>
                <p 
                  style={{
                    color: '#1f2937',
                    margin: '8px 0',
                    fontSize: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700
                  }}
                >
                  <span>Total Price:</span>
                  <span>₹{(p[2] * p[3]).toFixed(2) || 0}</span>
                </p>
              </div>
            </div>
          ))
        ) : (
          <p 
            style={{
              color: '#6b7280',
              textAlign: 'center',
              width: '100%',
              padding: '20px',
              background: '#f9fafb',
              borderRadius: '12px'
            }}
          >
            No products in this cart.
          </p>
        )}
      
    </div>

      {selectedCart.products && selectedCart.products.length > 0 && (
        <div 
          style={{
            marginTop: '25px',
            background: 'linear-gradient(145deg, #f3f4f6, #ffffff)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.04)'
          }}
        >
          <h4 
            style={{
              color: '#6b7280',
              margin: '10px 0',
              fontSize: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 20px'
            }}
          >
            <span>Total Quantity:</span>
            <span style={{fontWeight: 600, color: '#1f2937'}}>
              {selectedCart.products.reduce((sum, p) => sum + p[3], 0)}
            </span>
          </h4>
          <h4 
            style={{
              color: '#6b7280',
              margin: '10px 0',
              fontSize: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 20px',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '15px'
            }}
          >
            <span>Total Price:</span>
            <span style={{fontWeight: 700, color: '#10b981'}}>
              ₹{selectedCart.products.reduce((sum, p) => sum + p[2] * p[3], 0).toFixed(2)}
            </span>
          </h4>
        </div>
      )}
    </div>
  </div>
)}



        </div>
      </div>
    </>
  );
};

export default Cart;
<style jsx>
  {`
    /* Custom Scrollbar for Webkit Browsers */
    div::-webkit-scrollbar {
      height: 4px; /* Thin scrollbar */
    }

    div::-webkit-scrollbar-track {
      background: transparent; /* Transparent track */
    }

    div::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.5); /* Semi-transparent thumb */
      border-radius: 10px; /* Rounded corners */
    }

    div::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.7); /* Darker thumb on hover */
    }
  `}
</style>