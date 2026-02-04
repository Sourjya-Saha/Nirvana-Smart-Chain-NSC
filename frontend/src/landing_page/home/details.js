import React, { useEffect, useState } from 'react';
import Sidebar from '../Sidebar';
import Nav from './Nav';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { BarChart,  XAxis, YAxis,   CartesianGrid} from 'recharts';
import { useAuth } from '../user_login/AuthContext'; // Import your useAuth hook
import { PieChart, Pie, Cell } from "recharts";

import './Dashboard.css';
import './ProductList.css';

ChartJS.register(Title, Tooltip, Legend, ArcElement, BarElement, CategoryScale, LinearScale);

const Details = () => {
    const [productsData, setProductsData] = useState([]);
    const [ordersData, setOrdersData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // Default to current month
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    
    const { userId } = useAuth(); // Retrieve userId from AuthContext

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch user-specific products
                const productsResponse = await fetch('http://127.0.0.1:5000/getProducts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: userId }), // Send user_id in the request body
                });
                const products = await productsResponse.json();
                setProductsData(products);

                // Fetch user-specific orders
                const ordersResponse = await fetch('http://127.0.0.1:5000/getAllOrders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: userId }), // Send user_id in the request body
                });
                const orders = await ordersResponse.json();
                setOrdersData(orders);

                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        if (userId) {
            fetchData();
        }
    }, [userId]);

    if (loading) {
        return (
            <div>
                <div className='load'>
                    <div className='loader'>Loading...</div>
                </div>
                <p className='lding'>Loading Your Details....</p>
            </div>
        );
    }

    const calculateTopSellingProducts = () => {
        const productSales = {};
        if (!ordersData || ordersData.length === 0) return []; // Return empty if no orders

        ordersData.forEach(order => {
            order.order_details.forEach(item => {
                const { product_name, quantity, total_price } = item; // Destructure product details
                // Use product_name as key and calculate total sales based on quantity
                if (productSales[product_name]) {
                    productSales[product_name].totalSales += total_price; // Accumulate total sales
                    productSales[product_name].quantity += quantity; // Accumulate quantity sold
                } else {
                    productSales[product_name] = {
                        totalSales: total_price,
                        quantity: quantity,
                    };
                }
            });
        });

        return Object.entries(productSales)
            .map(([name, salesData]) => {
                const product = productsData.find(product => product.name === name);
                return product
                    ? { ...product, totalSales: salesData.totalSales, quantitySold: salesData.quantity }
                    : { name, totalSales: salesData.totalSales, quantitySold: salesData.quantity }; // Handle not found products
            })
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 5); // Top 5 selling products
    };

    const calculateRestockProducts = () => {
        return productsData.filter(product => product.quantity_of_uom < 10);
    };

    const topSellingProducts = calculateTopSellingProducts(); // Define topSellingProducts
    const restockProducts = calculateRestockProducts(); // Define restockProducts

    const calculateTotalSales = (orders) => {
        const sales = {};
        if (!orders || orders.length === 0) return sales; // Safeguard: return empty object if orders is undefined or empty

        orders.forEach(order => {
            if (order.order_details && Array.isArray(order.order_details)) { // Ensure products exists and is an array
                order.order_details.forEach(item => {
                    if (!sales[item.product_name]) {
                        sales[item.product_name] = 0;
                    }
                    sales[item.product_name] += item.total_price;
                });
            }
        });
        return sales;
    };

    const calculateOrderValues = (orders) => {
        const values = orders.map(order => order.total); // Use total from each order

        const average = values.reduce((sum, value) => sum + value, 0) / values.length || 0; // Prevent division by zero
        const mid = Math.floor(values.length / 2);
        const median = values.length % 2 !== 0 
            ? values[mid] // Odd length: middle value
            : (values[mid - 1] + values[mid]) / 2; // Even length: average of two middle values
        const highest = Math.max(...values);
        const lowest = Math.min(...values);
        const totalOrders = orders.length; // New total orders calculation
        const totalRevenue = values.reduce((sum, value) => sum + value, 0); // New total revenue calculation
        return { average, highest, lowest, totalOrders, totalRevenue , median }; // Include new data points
    };

    // Process data for charts
    const sales = calculateTotalSales(ordersData);
    console.log("Sales data:", sales);
  
    const sortedSales = Object.entries(sales).sort((a, b) => b[1] - a[1]);
    const top10Products = sortedSales.slice(0, 10);
    console.log("Top 10 products:", top10Products);
    const labels = top10Products.map(item => item[0]);
    const data = top10Products.map(item => item[1]);

    const { average, highest, lowest , median } = calculateOrderValues(ordersData);
    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF0000', '#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#33F6FF', '#F6FF33'];
   

    // Pie Chart Data
    const pieChartData = {
        labels,
        datasets: [
            {
                label: 'Top 10 Selling Products',
                data: data,
                backgroundColor: colors,
                borderWidth: 5
            }
        ]
    };

    const chartOptions = {
        cutout: '60%', // Adjust the thickness of the doughnut
        plugins: {
            legend: {
                display: true, // Enable the legend
                position: 'right', // Position legend to the right of the chart
                labels: {
                    color: '#333', // Set the label color
                    boxWidth: 30, // Width of the color box
                    padding: 10 // Spacing between labels
                }
            },
            tooltip: {
                enabled: true, // Enable tooltips on hover
                callbacks: {
                    label: (tooltipItem) => {
                        return `${tooltipItem.label}: ₹${tooltipItem.raw}`; // Customize tooltip labels
                    }
                }
            }
        }
    };
    

    // Bar Chart Data
    const barChartData = {
      labels: [
          'Average Order Value', 
          'Highest Order Value', 
          'Lowest Order Value', 
          'Median Order Value' // Add median label
      ],
      datasets: [
          {
              label: 'Order Values',
              data: [average, highest, lowest, median], // Include median in the data
              backgroundColor: ['#FF6384', '#36A2EB', '#8884d8', '#4BC0C0'], // Add a new color for median
              borderColor: ['#FF6384', '#36A2EB', '#8884d8', '#4BC0C0'],
              borderWidth: 0,
              barPercentage: 0.5, // Adjust bar width
              categoryPercentage: 0.7 // Adjust spacing between bars
          }
      ]
  };
  

    const options = {
        scales: {
            x: {
                grid: {
                    display: false, // Disable grid lines for the x-axis
                },
            },
            y: {
                grid: {
                    display: false, // Disable grid lines for the y-axis
                },
                ticks: {
                    beginAtZero: true, // Ensure the y-axis starts at 0
                }
            }
        }
    };
   
  


    // Helper function to get daily sales data for the selected month
  // Helper function to get daily sales data for the selected month
  const getDailySalesData = (orders) => { 
    const salesDataByDate = {};
  
    orders?.forEach((order) => {
      const date = new Date(Date.parse(order.datetime));
      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const day = date.getDate();
      
      if (year === new Date().getFullYear() && monthIndex === selectedMonth) {
        const dateKey = `${year}-${monthIndex + 1}-${day}`;
        if (!salesDataByDate[dateKey]) {
          salesDataByDate[dateKey] = 0;
        }
        salesDataByDate[dateKey] += order.total;
      }
    });
  
    if (Object.keys(salesDataByDate).length === 0) {
      // If no sales data for the selected month, return an empty array
      return [];
    }
  

    const daysInMonth = new Date(new Date().getFullYear(), selectedMonth + 1, 0).getDate();
    const dailySalesData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${new Date().getFullYear()}-${selectedMonth + 1}-${day}`;
      const sales = salesDataByDate[dateKey] || 0;
      dailySalesData.push({
        date: day,
        total: sales
      });
    }

    return dailySalesData;
  };

  const dailySalesData = getDailySalesData(ordersData);
  const monthlyTotal = dailySalesData.reduce((sum, entry) => sum + entry.total, 0);
  const maxSales = Math.max(...dailySalesData.map(item => item.total));
  const yAxisLabels = Array.from({ length: 6 }, (_, i) => {
    const value = (maxSales * (5 - i) / 5);
    return value.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  });

  
  console.log("Sales Data by Day:", dailySalesData);
  console.log("Monthly Total for Selected Month:", monthlyTotal);
  console.log("Max Sales:", maxSales);
  console.log("Yaxis:" , yAxisLabels)
  const styles = {
    yAxis: {
      position: 'absolute',
      left: -50,
      top: 0,
      bottom: '24px',
      width: '50px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      borderRight: '1px solid #ddd',
    },
    yAxisLabel: {
      fontSize: '12px',
      color: '#666',
      textAlign: 'right',
      paddingRight: '8px',
      transform: 'translateY(50%)',
    },
    yAxisLine: {
      position: 'absolute',
      left: '50px',
      right: 0,
      borderTop: '1px dashed #eee',
    },
  }
    return (
        <>
            <div className='dash-board' >
                <Sidebar />
                <div className='dashboard-container ' style={{paddingBottom:"20px" , paddingLeft:"0px" , paddingRight:"0px"}}>
                    <Nav />
                    <div className="product-list" style={{padding:"0px" , paddingLeft:"10px" , paddingBottom:"15px" , paddingTop:"20px"}}>
                        <div className="table-container">
                            <div className="table-section">
                                <h2 style={{
    fontSize: '24px', // Adjust font size
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
  }}>Top Selling Products</h2>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Image</th>
                                            <th>Name</th>
                                            <th>Category</th>
                                            <th>Price</th>
                                            <th>Total Sales</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topSellingProducts.map(product => (
                                            <tr key={product.id}>
                                                <td><img src={product.picture_of_the_prod} alt={product.name} className="table-image" /></td>
                                                <td>{product.name}</td>
                                                <td>{product.category}</td>
                                                <td>₹{product.price_per_unit}</td>
                                                <td>₹{product.totalSales}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="table-section">
                                <h2 style={{
    fontSize: '24px', // Adjust font size
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
  }}>Products to Restock</h2>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Image</th>
                                            <th>Name</th>
                                            <th>Category</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {restockProducts.map(product => (
                                            <tr key={product.id}>
                                                <td><img src={product.picture_of_the_prod} alt={product.name} className="table-image" /></td>
                                                <td>{product.name}</td>
                                                <td>{product.category}</td>
                                                <td>{product.quantity_of_uom}</td>
                                                <td>₹{product.price_per_unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div className="statistics">
                       
                    <div className="sales-graph-container">
  <div className="sales-header">
    <div className="title-section">
      <h2  style={{
    fontSize: '1.7rem', // Adjust font size
    color: 'rgb(51, 51, 51)', // Dark gray for readability
    // Add spacing above and below
    fontWeight: 'bold', // Make it stand out as a subtitle
    textTransform: 'capitalize', // Capitalize each word for a polished look
    letterSpacing: '1px', // Slight spacing between letters
    borderLeft: '4px solid #36A2EB', // Add a blue vertical accent
    paddingLeft: '10px',
    position:"relative",
    left:"-25px" // Add space between text and the accent
  }}>Sales Chart - Interactive</h2>
      <p style={{marginLeft : "0px" , marginTop:"10px" ,   position:"relative",
    left:"-25px"}}>Showing total sales for {months[selectedMonth]}</p>
    </div>
    <div className="controls-section">
      <div className="total-sales">
        <div 
          className="amount" 
          style={{ color: monthlyTotal > 0 ? 'green' : 'red' }}
        >
          ₹{monthlyTotal.toLocaleString('en-IN')}
        </div>
        <div className="label">Total Sales</div>
      </div>
      <select 
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(Number(e.target.value))}
        className="month-selector"
      >
        {months.map((month, index) => (
          <option key={month} value={index}>{month}</option>
        ))}
      </select>
    </div>
  </div>

  <div className="graph-container">
    {dailySalesData.length > 0 ? (
      <>
        <div style={styles.yAxis}>
          {yAxisLabels.map((label, index) => (
            <div key={index} style={{ position: 'relative' }}>
              <div style={styles.yAxisLabel}>{label}</div>
              <div style={{ ...styles.yAxisLine, top: `${index * 20}%` }} />
            </div>
          ))}
        </div>
        <div className="bars-container" >
          {dailySalesData.map((item, index) => (
            <div key={index} className="bar-wrapper">
              <div className="tooltip">
                ₹{item.total.toLocaleString('en-IN')}
              </div>
              <div 
                className="bar"
                style={{ height: `${(item.total / maxSales) * 100}%` }}
                title={`₹${item.total.toLocaleString('en-IN')}`}
              />
              {index % 5 === 0 && (
                <div className="date-label">
                  {item.date}
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    ) : (
      <div className="no-data-message">No sales data available for this month.</div>
    )}
  </div>
</div>


                        <div className='chart-container-bar' style={{marginTop :"0px"}}>
                            <div>
                                <h2 className='titless' style={{    fontSize: "1.7rem",
    color: "rgb(51, 51, 51)",
    fontWeight: "bold",
    marginBottom: "0px" ,
      fontSize: '1.7rem', // Adjust font size
      color: 'black', // Dark gray for readability
      // Add spacing above and below
      fontWeight: 'bold', // Make it stand out as a subtitle
      textTransform: 'capitalize', // Capitalize each word for a polished look
      letterSpacing: '1px', // Slight spacing between letters
      borderLeft: '4px solid #36A2EB', // Add a blue vertical accent
      paddingLeft: '10px', // Add space between text and the accent
    }}>Order Values Statistics </h2>
       <p style={{    fontSize: "16px",
    color: "#666" , marginBottom:"20px"}}>Graph based on Order value</p>
                                <Bar data={barChartData} options={options} />
                               
                            </div>
                        </div>
                        
                    </div>
                  





                </div>
            </div>
        </>
    );
};

export default Details;