import React, { useState } from 'react';
import { useAuth } from '../user_login/AuthContext'; // Import the useAuth hook
import './AddProduct.css';
import Sidebar from '../Sidebar';

function AddProduct() {
  const { userId } = useAuth(); // Get the user ID from the context
  const [product, setProduct] = useState({
    name: '',
    category: '',
    exp_date: '',
    price_per_unit: '',
    quantity_of_uom: '',
    shelf_num: '',
    uom_id: '',
    picture_of_the_prod: '', // Store the URL as a string
    description: '',
    user_id: userId, // Set user_id to the userId from context
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProduct((prevProduct) => ({
      ...prevProduct,
      [name]: name === 'quantity_of_uom' || name === 'price_per_unit' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('data', JSON.stringify(product));

    try {
      const response = await fetch('http://127.0.0.1:5000/insertProduct', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Product Added:', result);
        setProduct({
          name: '',
          category: '',
          exp_date: '',
          price_per_unit: '',
          quantity_of_uom: '',
          shelf_num: '',
          uom_id: '',
          picture_of_the_prod: '', // Reset URL
          description: '',
          user_id: userId, // Reset user_id to the current user ID
        });
      } else {
        console.error('Failed to add product:', response.statusText);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  return (
    <div className='dash-board'>
      <Sidebar />
      <div className="form-container">
        <form className="add-product-form" onSubmit={handleSubmit}>
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
  }}>Add Product</h2>
          <div className="form-group">
            <label>Product Name:</label>
            <input
              type="text"
              name="name"
              value={product.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Category:</label>
            <input
              type="text"
              name="category"
              value={product.category}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Expiry Date:</label>
            <input
              type="date"
              name="exp_date"
              value={product.exp_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Price:</label>
            <input
              type="number"
              name="price_per_unit"
              value={product.price_per_unit}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Quantity:</label>
            <input
              type="number"
              name="quantity_of_uom"
              value={product.quantity_of_uom}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Unit of Measurement (UOM):</label>
            <input
              type="number"
              name="uom_id"
              value={product.uom_id}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Shelf No.:</label>
            <input
              type="text"
              name="shelf_num"
              value={product.shelf_num}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Product Image URL:</label>
            <input
              type="text" // Use a text input to accept a URL
              name="picture_of_the_prod"
              value={product.picture_of_the_prod}
              onChange={handleChange}
              placeholder="Enter image URL"
            />
          </div>
          <div className="form-group">
            <label>Product Description:</label>
            <textarea
              name="description"
              value={product.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>
          <button type="submit" className="add-button">Add Product</button>
        </form>
      </div>
    </div>
  );
}

export default AddProduct;
