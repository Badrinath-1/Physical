import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './Navbar';
import Dashboard from './components/Dashboard';
import Schemes from './components/Schemes';
import Eligibility from './components/Eligibility';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schemes" element={<Schemes />} />
            <Route path="/eligibility" element={<Eligibility />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;