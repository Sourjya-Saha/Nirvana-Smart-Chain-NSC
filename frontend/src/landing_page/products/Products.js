import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddProduct from './AddProducts';
import './ProductManagement.css';
import Sidebar from '../Sidebar';
import axios from 'axios';
import { useAuth } from '../user_login/AuthContext'; // Import the useAuth hook

function Products() {
  const { userId } = useAuth(); // Get user ID from Auth context
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isShowing, setIsShowing] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const response = await axios.post('http://127.0.0.1:5000/getProducts', { user_id: userId });
      setProducts(response.data);
      console.log("All Products",response.data)
    } catch (err) {
      console.log("Something went wrong", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`http://127.0.0.1:5000/deleteProduct/${id}`);
      if (response.data.success) {
        setProducts(products.filter((product) => product.product_id !== id));
        console.log(`Product with ID ${id} deleted successfully`);
      } else {
        console.error('Failed to delete product');
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
        picture_of_the_prod: selectedProduct.picture_of_the_prod // Include the image URL
      };

      formData.append('data', JSON.stringify(updatedProduct));

      const response = await axios.post('http://127.0.0.1:5000/editProduct', formData);

      if (response.data.success) {
        const updatedProducts = products.map((product) =>
          product.product_id === selectedProduct.product_id ? updatedProduct : product
        );
        setProducts(updatedProducts);
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
    navigate('/addproducts');
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className='dash-board'>
      <Sidebar />
      <div className="product-management-container">
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
  }}>Product management</h2>
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
                <td className='product-table-buttons'>
                  <button className="action-button edit-button" onClick={() => handleEdit(product)}>
                    <i className="fa-solid fa-pen"></i>
                  </button>
                  <button className="action-button " onClick={() => handleDelete(product.product_id)}>
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
    </div>
  );
}

export default Products;
