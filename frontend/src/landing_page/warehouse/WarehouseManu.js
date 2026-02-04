import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../user_login/AuthContext';
import axios from 'axios';
import SideManu from '../SideManu';

function WarehouseManu() {
  const { userId } = useAuth(); // Retrieve userId from AuthContext
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isShowing, setIsShowing] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      fetchProducts();
    }
  }, [userId]); // Fetch products whenever userId changes

  const fetchProducts = async () => {
    try {
      const result = await axios.post("http://127.0.0.1:5000/getProductsManu", { user_id: userId });
      setProducts(result.data);
    } catch (err) {
      console.error("Error fetching products", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`http://127.0.0.1:5000/deleteProductManu/${id}`);
      if (response.status === 200 && response.data.success) {
        setProducts(products.filter((product) => product.product_id !== id));
      }
    } catch (err) {
      console.error("Error deleting product", err);
    }
  };

  const handleSave = async () => {
    try {
        const updatedProduct = {
            product_id: selectedProduct.product_id,
            name: selectedProduct.name,
            category: selectedProduct.category,
            expiry_date: selectedProduct.exp_date, // Match the backend field name
            price_per_unit: selectedProduct.price_per_unit,
            quantity_of_uom: selectedProduct.quantity_of_uom,
            shelf_num: selectedProduct.shelf_num,
            description: selectedProduct.description,
        };

        // Use FormData to mimic form submission
        const formData = new FormData();
        formData.append('data', JSON.stringify(updatedProduct));

        // Send the request with FormData
        const response = await axios.post('http://127.0.0.1:5000/editProductManu', formData);

        if (response.data.success) {
            // Update the products list with the edited product
            setProducts(products.map((product) =>
                product.product_id === selectedProduct.product_id 
                    ? { ...product, ...updatedProduct } 
                    : product
            ));
            setIsEditing(false);
        }
    } catch (error) {
        console.error("Error updating product", error);
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
    navigate('/productsmanu');
  };
  const handlePrint = () => {
    const printContents = document.getElementById('product-table').outerHTML;
    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <SideManu />
      <div className='dash-board'>
        <div className="product-management-container">
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
  fontFamily:"Poppins"
  }}>PRODUCT INVENTORY</h2>
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
            <button className="print-button" onClick={handlePrint}>
            Print Table
          </button>
          </div>
          <table className="product-table">
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
                  <td>&#x20b9;{product.price_per_unit}</td>
                  <td>
                    {product.quantity_of_uom === 0 ? (
                      <span className="status out-of-stock">Out of Stock</span>
                    ) : (
                      <span className="status available">Available</span>
                    )}
                  </td>
                  <td>{product.quantity_of_uom}</td>
                  <td>{product.shelf_num}</td>
                  <td>
                    <button className="action-button edit-button" onClick={() => { setSelectedProduct(product); setIsEditing(true); }}>
                      Edit
                    </button>
                    <button className="action-button delete-button" onClick={() => handleDelete(product.product_id)}>
                      Delete
                    </button>
                    <button className="action-button show-button" onClick={() => { setSelectedProduct(product); setIsShowing(true); }}>
                      Show
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isEditing && (
    <div className="modal" style={{
      backdropFilter: 'blur(5px)',
    }}>
      <div className="modal-content">
        <h2 style={{
          fontSize: '26px',
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
          fontFamily: "Poppins"
        }}>edit product</h2>
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
          
          <label>Expiry Date:</label>
          <input 
            type="date" 
            name="exp_date"
            value={selectedProduct.exp_date ? new Date(selectedProduct.exp_date).toISOString().split('T')[0] : ''} 
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
          
          <label>Shelf No. :</label>
          <input 
            type="text" 
            name="shelf_num" 
            value={selectedProduct.shelf_num} 
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
        <button className="cancel-button" onClick={handleCloseModal}>Cancel</button>
      </div>
    </div>
  )}

          {isShowing && (
            <div className="modal" style={{
              backdropFilter: 'blur(5px)',  // Applying a blur effect with a 5px radius
            }}>
              <div className="modal-content">
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
  fontFamily:"Poppins"
  }}>Product details</h2>
                <p><strong>Name:</strong> {selectedProduct.name}</p>
                <p><strong>Category:</strong> {selectedProduct.category}</p>
                <p><strong>Expiry Date:</strong> {selectedProduct.exp_date}</p>
                <p><strong>Price:</strong> &#x20b9;{selectedProduct.price_per_unit.toFixed(2)}</p>
                <p><strong>Quantity:</strong> {selectedProduct.quantity_of_uom}</p>
                <p><strong>Shelf No. :</strong> {selectedProduct.shelf_num}</p>
                <p><strong>Description:</strong> {selectedProduct.description}</p>
                <button className="close-button" onClick={handleCloseModal}>Close</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default WarehouseManu;
