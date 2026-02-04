import React, { useState } from 'react';
import './ShipmentDialog.css';

const ShipmentOrderDialog = ({ product, isOpen, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const handleOrderType = async (orderType) => {
    console.log('Starting order process for:', orderType);
    console.log('Selected product:', product);
    
    setLoading(true);
    setError(null);
    
    try {
      if (orderType === 'manufacturer') {
        console.log('Fetching manufacturers list...');
        const manufacturersResponse = await fetch('http://127.0.0.1:5000/get_manufacturer_users');
        if (!manufacturersResponse.ok) throw new Error('Failed to fetch manufacturers list');
        const manufacturersList = await manufacturersResponse.json();
        console.log('Manufacturers list received:', manufacturersList);
        
        const allProducts = [];
        console.log('Fetching products from each manufacturer...');
        
        for (let [manufacturerName, manufacturerId] of Object.entries(manufacturersList)) {
          console.log(`Fetching products for manufacturer: ${manufacturerName} (ID: ${manufacturerId})`);
          const response = await fetch('http://127.0.0.1:5000/getProductsManu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: manufacturerId }),
          });
          
          if (response.ok) {
            const products = await response.json();
            console.log(`Received ${products.length} products from manufacturer ${manufacturerName}`);
            allProducts.push(...products.map(p => ({
              ...p,
              manufacturerId,
              manufacturerName
            })));
          }
        }
        
        console.log('Searching for matching product...');
        const matchedProduct = allProducts.find(p => 
          p.name.toLowerCase().trim() === product.name.toLowerCase().trim()
        );
        
        if (matchedProduct) {
          console.log('Found matching product:', matchedProduct);
          const navigationState = {
            orderType: 'manufacturer',
            preSelectedManufacturer: {
              id: matchedProduct.manufacturerId,
              name: matchedProduct.manufacturerName
            },
            preSelectedProduct: {
              name: matchedProduct.name,
              price: matchedProduct.price_per_unit,
              product_id: matchedProduct.product_id
            }
          };
          console.log('Sending navigation state:', navigationState);
          onConfirm(navigationState);
          onClose();
        } else {
          throw new Error('Product not found with any manufacturer');
        }
      } else {
        console.log('Fetching wholesalers list...');
        const wholesalersResponse = await fetch('http://127.0.0.1:5000/get_wholesaler_users');
        if (!wholesalersResponse.ok) throw new Error('Failed to fetch wholesalers list');
        const wholesalersList = await wholesalersResponse.json();
        console.log('Wholesalers list received:', wholesalersList);
        
        const allProducts = [];
        console.log('Fetching products from each wholesaler...');
        
        for (let [wholesalerName, wholesalerId] of Object.entries(wholesalersList)) {
          console.log(`Fetching products for wholesaler: ${wholesalerName} (ID: ${wholesalerId})`);
          const response = await fetch('http://127.0.0.1:5000/getProductsWhole', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: wholesalerId }),
          });
          
          if (response.ok) {
            const products = await response.json();
            console.log(`Received ${products.length} products from wholesaler ${wholesalerName}`);
            allProducts.push(...products.map(p => ({
              ...p,
              wholesalerId,
              wholesalerName
            })));
          }
        }
        
        console.log('Searching for matching product...');
        const matchedProduct = allProducts.find(p => 
          p.name.toLowerCase().trim() === product.name.toLowerCase().trim()
        );
        
        if (matchedProduct) {
          console.log('Found matching product:', matchedProduct);
          const navigationState = {
            orderType: 'wholesaler',
            preSelectedWholesaler: {
              id: matchedProduct.wholesalerId,
              name: matchedProduct.wholesalerName
            },
            preSelectedProduct: {
              name: matchedProduct.name,
              price: matchedProduct.price_per_unit,
              product_id: matchedProduct.product_id
            }
          };
          console.log('Sending navigation state:', navigationState);
          onConfirm(navigationState);
          onClose();
        } else {
          throw new Error('Product not found with any wholesaler');
        }
      }
    } catch (error) {
      console.error('Error in order process:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="celestial-overlay">
      <div className="celestial-dialog">
        <button 
          onClick={onClose}
          className="celestial-close-btn"
          disabled={loading}
        >
          ×
        </button>

        <h2 className="celestial-title">
          Select Your Order Path
        </h2>
        
        {error && (
          <div className="celestial-alert">
            <span className="alert-icon">⚠</span>
            <div className="alert-content">
              <div className="alert-title">{error}</div>
              <div className="alert-message">Please try again or contact support</div>
            </div>
          </div>
        )}
        
        <div className="celestial-buttons">
          <button
            onClick={() => handleOrderType('manufacturer')}
            onMouseEnter={() => setHoveredButton('manufacturer')}
            onMouseLeave={() => setHoveredButton(null)}
            disabled={loading}
            className="celestial-btn manufacturer-btn"
          >
            <span className="btn-icon">🏭</span>
            <span className="btn-text">Order from Manufacturer</span>
            <div className="btn-shine"></div>
          </button>
          
          <button
            onClick={() => handleOrderType('wholesaler')}
            onMouseEnter={() => setHoveredButton('wholesaler')}
            onMouseLeave={() => setHoveredButton(null)}
            disabled={loading}
            className="celestial-btn wholesaler-btn"
          >
            <span className="btn-icon">🏪</span>
            <span className="btn-text">Order from Wholesaler</span>
            <div className="btn-shine"></div>
          </button>
          
          <button
            onClick={onClose}
            disabled={loading}
            className="celestial-btn cancel-btn"
          >
            Cancel Order
          </button>
        </div>
        
        {loading && (
          <div className="celestial-loading">
            <div className="loading-spinner"></div>
            <span className="loading-text">Processing your request...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentOrderDialog;