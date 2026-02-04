// ProductsWhole.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SideWhole from "../SideWhole.js";
import axios from 'axios';
import { useAuth } from '../user_login/AuthContext';

function ProductsWhole() {
  const { userId } = useAuth();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const [expandedCart, setExpandedCart] = useState(null);
  const [cartProducts, setCartProducts] = useState({});

  const navigate = useNavigate();
  const parseReferenceCart = (referenceCartStr) => {
    if (!referenceCartStr) return null;
    try {
      return JSON.parse(referenceCartStr);
    } catch (e) {
      console.error('Error parsing reference_cart:', e);
      return null;
    }
  };

  const getExpiryStatus = (expDate) => {
    const today = new Date();
    const expiryDate = new Date(expDate);
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    const yearsUntilExpiry = daysUntilExpiry / 365;

    if (daysUntilExpiry < 0) return { status: 'Expired', color: '#dc3545', bgColor: '#ffebee', textColor: 'white' };
    if (daysUntilExpiry <= 30) return { status: 'Expiring Soon', color: '#fd7e14', bgColor: '#fff3e0', textColor: 'white' };
    if (yearsUntilExpiry >= 2) return { status: 'Long Shelf Life', color: '#28a745', bgColor: '#e8f5e9', textColor: 'white' };
    return { status: 'Good', color: '#4caf50', bgColor: '#f1f8e9', textColor: 'white' };
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:5000/getProductsWhole', { user_id: userId });
      const allProducts = response.data;
      setProducts(allProducts);
      console.log(allProducts)
      const cartMap = new Map();
      
      allProducts.forEach(product => {
        const referenceCart = parseReferenceCart(product.reference_cart);
        
        if (referenceCart) {
          Object.values(referenceCart).forEach(cartInfo => {
            const cartId = cartInfo.cart_id;
            if (!cartMap.has(cartId)) {
              cartMap.set(cartId, []);
            }
            cartMap.get(cartId).push({
              ...product,
              cart_quantity: cartInfo.quantity,
              cart_exp_date: cartInfo.exp_date
            });
          });
        } else {
          if (!cartMap.has('unassigned')) {
            cartMap.set('unassigned', []);
          }
          cartMap.get('unassigned').push({
            ...product,
            cart_quantity: product.quantity_of_uom,
            cart_exp_date: product.exp_date
          });
        }
      });

      const groupedByCart = {};
      cartMap.forEach((products, cartId) => {
        groupedByCart[cartId] = products.sort((a, b) => {
          const dateA = new Date(a.cart_exp_date);
          const dateB = new Date(b.cart_exp_date);
          return dateA - dateB;
        });
      });

      setCartProducts(groupedByCart);
    } catch (err) {
      console.log("Something went wrong", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`http://127.0.0.1:5000/deleteProductWhole/${id}`);
      if (response.data.success) {
        setProducts(products.filter((product) => product.product_id !== id));
        fetchData(); // Refresh all data after deletion
      }
    } catch (err) {
      console.error("Something went wrong while deleting the product", err);
    }
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setIsEditing(true);
  };

  const handleShow = (product) => {
    setSelectedProduct(product);
    setIsShowing(true);
  };

  const handleSave = async () => {
    try {
      const formData = new FormData();
      const updatedProduct = {
        product_id: selectedProduct.product_id,
        name: selectedProduct.name,
        category: selectedProduct.category,
        exp_date: selectedProduct.exp_date,
        price_per_unit: selectedProduct.price_per_unit,
        quantity_of_uom: selectedProduct.quantity_of_uom,
        shelf_num: selectedProduct.shelf_num,
        description: selectedProduct.description,
        picture_of_the_prod: selectedProduct.picture_of_the_prod
      };

      formData.append('data', JSON.stringify(updatedProduct));

      const response = await axios.post('http://127.0.0.1:5000/editProductWhole', formData);

      if (response.data.success) {
        fetchData(); // Refresh all data after edit
        setIsEditing(false);
      } else {
        console.error('Failed to update product');
      }
    } catch (error) {
      console.error('Error occurred while updating product:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSelectedProduct((prevProduct) => ({
      ...prevProduct,
      [name]: name === 'price_per_unit' || name === 'quantity_of_uom' 
        ? parseFloat(value) 
        : value
    }));
  };

  const handleCloseModal = () => {
    setIsEditing(false);
    setIsShowing(false);
    setSelectedProduct(null);
  };

  const handleAddProduct = () => {
    navigate('/addproductwhole');
  };



  const toggleCart = (cartId) => {
    setExpandedCart(expandedCart === cartId ? null : cartId);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  

  return (
    <div className='dash-board'>
      <SideWhole />
      <div className="product-management-container">
        <h2 className="section-title">Product Management</h2>
        
        <div className="top-bar">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-bar-product"
          />
          <button className="add-product-button" onClick={handleAddProduct}>
            Add Product
          </button>
        </div>

        {/* Original Product Table */}
        <table id="product-table" className="product-table">
          <thead>
            <tr>
              <th>ID</th>
              
              <th>Name</th>
              <th>Category</th>
              <th>Expiry Date</th>
              <th>Price</th>
              <th>Availability</th>
              <th>Quantity</th>
              <th>Shelf No.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.product_id}>
                <td>{product.product_id}</td>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>{product.exp_date}</td>
                <td>₹{product.price_per_unit.toFixed(2)}</td>
                <td>
                  {product.quantity_of_uom === 0 ? (
                    <span className="status out-of-stock">Out of Stock</span>
                  ) : (
                    <span className="status available">Available</span>
                  )}
                </td>
                <td>{product.quantity_of_uom}</td>
                <td>{product.shelf_num}</td>
                <td style={{display:"flex" , justifyContent:"center"}}>
                  <button className="action-button edit-button" onClick={() => handleEdit(product)}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="action-button delete-button" onClick={() => handleDelete(product.product_id)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                  <button className="action-button show-button" onClick={() => handleShow(product)}>
                    <i className="fa-solid fa-eye"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Cart-based Product Organization */}
        <h2 className="section-title">Products By Cart</h2>
        <div className="cart-container">
          {Object.entries(cartProducts).map(([cartId, products]) => {
            // Calculate cart statistics
            const expiredCount = products.filter(p => getExpiryStatus(p.cart_exp_date).status === 'Expired').length;
            const expiringSoonCount = products.filter(p => getExpiryStatus(p.cart_exp_date).status === 'Expiring Soon').length;
            const totalValue = products.reduce((sum, p) => sum + (p.price_per_unit * p.cart_quantity), 0);

            return (
              <div key={cartId} className="cart-card">
                <div 
                  className="cart-header" 
                  onClick={() => toggleCart(cartId)}
                  style={{backgroundColor:"#007bff"}}
                >
                  <div className="cart-title" style={{display:"flex" , alignContent:"center"}} >
                  <i className="fa-solid fa-cart-shopping cart-icon" style={{
    color: "white",  // White color for the icon
    fontSize: "20px",  // Moderate size for a clean look
    transition: "transform 0.3s ease, color 0.3s ease",  // Smooth transition for hover effects
    cursor: "pointer",  // Pointer cursor to indicate it's clickable
    padding: "12px",  // Padding for better spacing around the icon
    borderRadius: "50%",  // Circular shape for a modern touch
    background: "rgba(0, 0, 0, 0.3)",  // Subtle dark background to highlight the icon
    display: "inline-flex",  // Ensure it's inline and flexible with other elements
    alignItems: "center",  // Center icon vertically
    justifyContent: "center",  // Center icon horizontally
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",  // Light shadow for depth
    margin: "0 10px",  // Margin for spacing between other elements
}} 
onMouseEnter={(e) => e.target.style.color = "#ff9900"}  // Hover color change
onMouseLeave={(e) => e.target.style.color = "white"}  // Return to original color
/>

                    <h3 style={{
    color: "white",
    textAlign: "center",
    marginBottom: "0",
    fontSize: "14px",  // Smaller font size
    fontWeight: "400",  // Light weight for a modern feel
    letterSpacing: "0.5px",  // Slightly increased letter spacing for readability
    textTransform: "uppercase",  // All caps for a sleek look
   // Modern sans-serif font
    padding: "10px",  // Slight padding for a balanced look
    background: "rgba(0, 0, 0, 0.4)",  // Subtle background for emphasis
    borderRadius: "5px",  // Rounded corners for a contemporary style
    
}}>
  Cart {cartId === 'unassigned' ? '(Unassigned)' : cartId}
</h3>

                    <div className="cart-stats-here" style={{color:"white"}}>
                      <span className="cart-badge"  style={{color:"white"}}>{products.length} items</span>
                      <span className="cart-value"  style={{color:"white"}}>₹{totalValue.toFixed(2)}</span>
                      {expiredCount > 0 && (
                        <span className="status-badge expired" >
                          {expiredCount} Expired
                        </span>
                      )}
                      {expiringSoonCount > 0 && (
                        <span className="status-badge expiring">
                          {expiringSoonCount} Expiring Soon
                        </span>
                      )}
                    </div>
                  </div>
                  <i className={`fa-solid ${expandedCart === cartId ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{color:"white"}}></i>
                </div>

                {expandedCart === cartId && (
                  <div className="cart-content">
                    <table  id="product-table" className="product-table">
                      <thead>
                        <tr>
                        <th>Image</th>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Quantity</th>
                          <th>Expiry Status</th>
                          <th>Price (₹)</th>
                          <th>Total (₹)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((product) => {
                          const expiryStatus = getExpiryStatus(product.cart_exp_date);
                          return (
                            <tr 
                              key={`${product.product_id}-${cartId}`}
                              style={{ backgroundColor: expiryStatus.bgColor }}
                            >
                                <td style={{backgroundColor:"white"}}>
                                <div >
                                  {product.picture_of_the_prod && (
                                    <img 
                                      src={product.picture_of_the_prod} 
                                      alt={product.name}
                                      height={100}
                                      width={100}
                                     
                                    />
                                  )}
                                 
                                </div>
                              </td>
                              <td style={{backgroundColor:"white"}}>
                                <div >
                                  <span>{product.name}</span>
                                </div>
                              </td>
                              <td style={{backgroundColor:"white"}}>{product.category}</td>
                              <td style={{backgroundColor:"white"}}>{product.cart_quantity}</td>
                              <td style={{backgroundColor:"white"}}>
                                <span 
                                  className="expiry-status"
                                  style={{ 
                                    backgroundColor: expiryStatus.color,
                                    color: expiryStatus.textColor
                                  }}
                                >
                                  {expiryStatus.status}
                                </span>
                              </td>
                              <td style={{backgroundColor:"white"}}>{product.price_per_unit.toFixed(2)}</td>
                              <td style={{backgroundColor:"white"}}> {(product.price_per_unit * product.cart_quantity).toFixed(2)}</td>
                              <td style={{ backgroundColor:"white"}}>
                                <div  style={{display:"flex" , justifyContent:"center"}}>
                                  <button 
                                    className="action-button edit-button" 
                                    onClick={() => handleEdit(product)}
                                    title="Edit"
                                  >
                                    <i className="fa-solid fa-pen"></i>
                                  </button>
                                  <button 
                                    className="action-button show-button" 
                                    onClick={() => handleShow(product)}
                                    title="View Details"
                                  >
                                    <i className="fa-solid fa-eye"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>


        {/* Edit Modal */}
        {isEditing && (
          <div className="modal" style={{
            backdropFilter: 'blur(5px)',  // Applying a blur effect with a 5px radius
          }}>
            <div className="modal-content">
            <h2 style={{
    fontSize: '25px', // Adjust font size
        fontFamily: 'Poppins',
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
  }}>Edit product</h2>
              <div className="edit-form">
                <label>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={selectedProduct.name}
                  onChange={handleInputChange}
                />
                <label>Category:</label>
                <input
                  type="text"
                  name="category"
                  value={selectedProduct.category}
                  onChange={handleInputChange}
                />
                <label>Price:</label>
                <input
                  type="number"
                  name="price_per_unit"
                  value={selectedProduct.price_per_unit}
                  onChange={handleInputChange}
                />
                <label>Quantity:</label>
                <input
                  type="number"
                  name="quantity_of_uom"
                  value={selectedProduct.quantity_of_uom}
                  onChange={handleInputChange}
                />
                <label>Shelf No.:</label>
                <input
                  type="text"
                  name="shelf_num"
                  value={selectedProduct.shelf_num}
                  onChange={handleInputChange}
                />
                <label>Product Image URL:</label>
                <input
                  type="text"
                  name="picture_of_the_prod"
                  value={selectedProduct.picture_of_the_prod}
                  onChange={handleInputChange}
                />
                <label>Description:</label>
                <textarea
                  name="description"
                  value={selectedProduct.description}
                  onChange={handleInputChange}
                />
              </div>
              <button className="save-button" onClick={handleSave}>Save</button>
              <button className="close-button" onClick={handleCloseModal}>Cancel</button>
            </div>
          </div>
        )}


        {/* Show Modal */}
        {isShowing && (
          <div className="modal" style={{
            backdropFilter: 'blur(5px)',  // Applying a blur effect with a 5px radius
          }}>
            <div className="modal-content">
            <h2 style={{
    fontSize: '25px', // Adjust font size
    fontFamily: 'Poppins',
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
  }}>Product Details</h2>
              <p><strong>Name:</strong> {selectedProduct.name}</p>
              <p><strong>Category:</strong> {selectedProduct.category}</p>
              <p><strong>Expiry Date:</strong> {selectedProduct.exp_date}</p>
              <p><strong>Price:</strong> &#x20b9;{selectedProduct.price_per_unit.toFixed(2)}</p>
              <p><strong>Quantity:</strong> {selectedProduct.quantity_of_uom}</p>
              <p><strong>Shelf No.:</strong> {selectedProduct.shelf_num}</p>
              <p><strong>Description:</strong> {selectedProduct.description}</p>
              <img src={selectedProduct.picture_of_the_prod} style={{ height: "200px", width: "200px", alignSelf: "center" }} alt={selectedProduct.name} className="product-image" />
              <button className="close-button" onClick={handleCloseModal}>Close</button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .dash-board {
          display: flex;
          width: 100%;
          min-height: 100vh;
          background-color: #f5f5f5;
        }

        .product-management-container {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          margin-right:90px;
        }

        .section-title {
          font-size: 30px;
          color: #333;
          text-align: center;
          margin: 20px 0;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          border-bottom: 2px solid #FF6384;
          padding-bottom: 10px;
          width: fit-content;
          margin-inline: auto;
        }

        .search-container {
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #666;
        }

        .search-bar-product {
          padding: 12px 16px 12px 40px;
          border: 1px solid #ddd;
          border-radius: 8px;
          width: 100%;
          font-size: 16px;
          transition: all 0.3s ease;
        }

        .search-bar-product:focus {
          border-color: #FF6384;
          box-shadow: 0 0 0 2px rgba(255, 99, 132, 0.2);
          outline: none;
        }

        .cart-card {
          margin-bottom: 20px;
          border: 1px solid #ddd;
          border-radius: 12px;
          overflow: hidden;
          background-color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
        }

        .cart-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .cart-header {
          padding: 20px;
          background-color: #f8f9fa;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
        }

        .cart-header:hover {
          background-color: #f0f0f0;
        }

        .cart-title {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .cart-icon {
          color: #FF6384;
          font-size: 24px;
        }

        .cart-stats-here {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .cart-badge {
          background-color: #FF6384;
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .cart-value {
          background-color: #4CAF50;
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }

        .status-badge.expired {
          background-color: #dc3545;
          color: white;
        }

        .status-badge.expiring {
          background-color: #fd7e14;
          color: white;
        }

        .cart-content {
          padding: 20px;
        }

        .cart-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-top: 10px;
        }

        .cart-table th {
          background-color: #f8f9fa;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #333;
          border-bottom: 2px solid #ddd;
        }

        .cart-table td {
          padding: 12px;
          border-bottom: 1px solid #eee;
        }

        .product-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .product-thumbnail {
          width: 40px;
          height: 40px;
          object-fit: cover;
          border-radius: 4px;
        }

        .expiry-status {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          display: inline-block;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .action-button {
          padding: 8px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          color: white;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
        }

        .action-button:hover {
          transform: translateY(-2px);
        }

        .edit-button {
          background-color: #4CAF50;
        }

        .edit-button:hover {
          background-color: #45a049;
        }

        .show-button {
          background-color: #2196F3;
        }

        .show-button:hover {
          background-color: #1e88e5;
        }

        .delete-button {
          background-color: #f44336;
        }

        .delete-button:hover {
          background-color: #e53935;
        }

        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(5px);
        }

        .modal-content {
          background-color: white;
          border-radius: 12px;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #eee;
        }

        .modal-title {
          font-size: 24px;
          color: #333;
          margin: 0;
        }

        .product-details {
          padding: 20px;
        }

        .product-image-container {
          text-align: center;
          margin-bottom: 20px;
        }

        .product-image {
          max-width: 300px;
          max-height: 300px;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .no-image {
          width: 300px;
          height: 200px;
          background-color: #f8f9fa;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          margin: 0 auto;
        }

        .no-image i {
          font-size: 48px;
          color: #ccc;
          margin-bottom: 10px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 20px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .detail-item.full-width {
          grid-column: 1 / -1;
        }

        .detail-label {
          font-size: 14px;
          color: #666;
          font-weight: 500;
        }

        .detail-value {
          font-size: 16px;
          color: #333;
          font-weight: 500;
        }

        .detail-value.description {
          font-weight: normal;
          white-space: pre-wrap;
        }

        .expiry-badge {
          margin-left: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .add-product-button {
          padding: 12px 24px;
          background-color: #FF6384;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .add-product-button:hover {
          background-color: #ff4f75;
          transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .product-management-container {
            padding: 10px;
          }
          
          .details-grid {
            grid-template-columns: 1fr;
          }
          
          .search-container {
            max-width: none;
          }
          
          .top-bar {
            flex-direction: column;
            gap: 10px;
          }
          
          .add-product-button {
            width: 100%;
            justify-content: center;
          }
          
          .cart-stats-here {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}

export default ProductsWhole;