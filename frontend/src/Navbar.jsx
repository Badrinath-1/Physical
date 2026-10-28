import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/">
          <h1>PwD Fund Tracker</h1>
        </Link>
      </div>
      <ul className="navbar-links">
        <li><Link to="/">Dashboard</Link></li>
        <li><Link to="/schemes">Schemes Directory</Link></li>
        <li><Link to="/eligibility">Eligibility</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;