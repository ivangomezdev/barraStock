const fs = require('fs');
const path = require('path');

// --- Helper to write files ---
const writeFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content.trim());
  console.log(`Created: ${filePath}`);
};

// --- DATA ---
const BOTTLE_DATA = {
  "WHISKY": ["ETIQUETA ROJA", "ETIQUETA NEGRA", "ETIQUETA NEGRA DOUBLE JACK", "Green Label", "J&B", "BUCHANANS 12", "BUCHANANS MASTER", "BUCHANANS 18 / CHIVAS 18", "JEAN BEAN", "JEAN BEAN BLACK", "CANADIAN CLUB", "MARKS", "JACK DANIELS", "JACK DANIELS SINGLE BARREL", "JACK DANIELS GENTLEMAN", "CHIVAS REAL 12", "CHIVAS 18", "OLD PARR", "WILLIAM LAWSON", "GLENFIDDICH", "MACALLAN 12", "MACALLAN 15", "JAMESON", "MAKERS MARKS", "FIREBALL", "GREEN"],
  "TEQUILA": ["CENTENARIO REPOSADO", "CENTENARIO PLATA", "DON JULIO REPOSADO", "DON JULIO AÑEJO", "DON JULIO BLANCO", "DON JULIO 70", "HERRADURA ULTRA", "HERRADURA REPOSADO", "HERRADURA AÑEJO", "HERRADURA BLANCO", "JOSE CUERVO ESPECIAL REP.", "JOSE CUERVO TRADICIONAL", "TEQUILA 1800 BLANCO", "TEQUILA 1800 AÑEJO", "CAZADORES REPOSADO", "CAZADRES BLANCO", "HORNITOS BLACK 3 GENERACIONES", "CENTENARIO AÑEJO", "ANTIGUO", "JIMADOR REPOSADO", "LEYENDA MILAGRO BLANCO", "LEYENDA MILAGRO MANDARINA", "MAESTRO TEQUILA BLANCO (DOBEL)", "HORNITOS PLATA", "SAUZA 3 GENERACIONES", "AGAVERO", "ZIGNUM REPOSADO", "FLAMINGO SAMBUCA", "CONTY SAMBUCA", "BLANCO CRISTALINO 1800", "DON JULIO 1942 AÑEJO"],
  "MEZCAL": ["MEZCAL AMORES", "MEZCAL 400 CONEJOS", "MEZCAL UNION", "PAPA DIABLO ESPADIN", "PAPA DIABLO MAGICO", "PAPA DIABLO ESPECIAL", "WILD TURKEY", "MI FAMILIA FLORES", "1800 REPOSADO", "MONTELOBO"],
  "BRANDY": ["TORRES 10", "TORRES 15", "TORRES 5"],
  "COGNAC": ["REMY MARTIN VSOP", "MARTELL VSOP", "HENNESSY", "CAMUS VSOP (HENNESSY)"],
  "VODKA": ["ABSOLUT AZUL", "ABSOLUT RASPBERRY", "ABSOLUT CITRON", "ABSOLUT MANDARIN", "ABSOLUT PEACH", "ABSOLUT PEARS", "ABSOLUT MANGO", "ABSOLUT BERRIACA", "STOLICHNAYA", "SMIRNOFF", "SMIRNOFF CITRUS", "SMIRNOFF GREEN APPLE", "WYBOROWA", "GREY GOOSE", "KETEL ONE", "GOTLAND / TITOS", "GREEN GOOSE POIRE", "CIROC VODKA", "BELVEDERE", "ALCOHOL BATALLA", "RON BATALLA", "VODKA BATALLA", "TEQUILA BATALLA", "GINEBRA BATLLA", "BRANDY BATALLA", "CONTROY"],
  "AGUAS IMPORTADAS": ["PERRIER", "SAN PELLEGRINO", "EVIAN"],
  "VINO ESPUMOSO": ["LUNATO LAMBRUSCO ROSATTO", "LAMBRUSCO ROSDO", "LAMBRUSCO BLANCO", "BRUT DE LA CASA", "PROSSECO", "MOSCATO"],
  "VINO BLANCO": ["VINO BLANCO DE LA CASA (COCINA)", "SAUVIGON BLANCO", "CHARDONNAY", "PINOT GRIGIO", "PINOT GRIGIO ALMA MORA"],
  "VINO TINTO": ["SYRAH", "CAB. SAUVAGINION", "DE LA CASA MALBEC", "MERLOT", "PINOT NOIR", "LAMBRUSCO VENTA", "TORREROSA"],
  "LICORES": ["LICOR 43", "CINZANO EXTRA DRAY", "CINZANO BLANCO", "CINZANO ROSSO", "APEROL", "PERNOD", "DUDONNET", "LICOR DE MANZANA", "FERNET", "FRANGELICO", "MIDORI/LICOR DE MELON", "ANIS CHINCHON DULCE", "ANIS CHINCHON SECO", "AMARETO DI SAROMNO", "VACARI SAMBUCA NEGRO", "VACARI SAMBUCA BLANCO", "CAMPARI", "BAILEYS", "LICOR DE DURAZNO", "DRAMBUY / AVERNA", "KAHLUA", "CONTROY / COINTREAU", "STREGA", "CARAJITO CAFE", "OPTAWNY", "OP 10", "PISCO", "GRAND MARNIER", "JAGERMAISTER", "CARAJILLO", "CASSIS", "CURACAO AZUL", "MARTINI ROSSO", "MARTINI DRY", "MARTINI BLANCO", "GRANADINA"],
  "GINEBRA": ["TANQUERAY", "BOMBAY", "HENDRICKS", "BEEFEATER"],
  "RON": ["BACARDI BLANCO", "BACARDI AÑEJO", "SOLERO", "BARCELO BLANCO", "BOTRAN", "ZACAPA 23 AÑOS", "BARCELO AÑEJO", "MATUSALEM GRAN RESERVA", "MATUSALEM PLATINO", "MATUSALEN CLASICO", "HAVANA 7", "HAVANA CLUB AÑEJO ESPECIAL", "BAREDO", "MALIBU", "APLETON SPECIAL", "APLETON WHITE", "CAPTAIN MORGAN", "HAVANA CLUB 3", "KINGSTON 62", "FLOR DE CAÑA", "ZACAPA 23 AÑOS", "APLETON STATE 12", "HAVANA SELECT", "BARCELO AÑEJO", "BARCELO PLATA", "TANAUCRAY 10"],
  "CERVEZAS": ["CORONA EXTRA", "VICTORIA", "PACIFICO", "NEGRA MODELO", "MODELO ESPECIAL", "MODELO DORADO", "CORONA LIGHT", "STELLA", "ULTRA", "1/4 CORONITA SIN ALCOHOL", "SERPIENTE", "GUERRERO", "LUZ DE SOL", "ARRECIFE"],
  "REFRESCOS": ["COCA-COLA", "COCA COLA ZERO", "MINERAL 8 OZ", "COCA COLA 8 OZ", "COCA-COLA LIGHT", "COCA ZERO 8 OZ", "COCA LIGTH 8 OZ", "FANTA", "MANZANITA LIFT", "AGUA MINERAL", "AGUA PURIFICADA / CIEL", "AGUA QUINA", "7UP", "FRESCA", "SQUIRT", "SPRITE", "MUNDET", "GINGER ALL", "PEÑAFIEL MINERAL"],
  "ENERGIZANTES": ["RED BULL", "BOOST"]
};

const RESTAURANTS = [
  "Negro Amaro", "Club Social", "Boston", "Mandarinas Café", "Mandarino Beach"
];

// --- 1. package.json ---
const packageJson = {
  "name": "bartender-stock-system",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "firebase": "^10.0.0",
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
};
writeFile('package.json', JSON.stringify(packageJson, null, 2));

// --- 2. Configuration Files ---
const nextConfig = `
/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig
`;
writeFile('next.config.js', nextConfig);

// --- 3. Firebase Config & Data Lib ---
const firebaseConfig = `
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "123",
  appId: "123"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
`;
writeFile('src/lib/firebase.js', firebaseConfig);

const dataLib = `
export const BOTTLE_DATA = ${JSON.stringify(BOTTLE_DATA, null, 2)};
export const RESTAURANTS = ${JSON.stringify(RESTAURANTS, null, 2)};
`;
writeFile('src/lib/data.js', dataLib);

// --- 4. CSS Files (BEM) ---

const globalCss = `
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #f4f4f9;
  color: #333;
}
`;
writeFile('src/styles/global.css', globalCss);

const loginCss = `
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #2c3e50;
}
.login-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
.login-form__title {
  margin-bottom: 1.5rem;
  text-align: center;
  color: #2c3e50;
}
.login-form__group {
  margin-bottom: 1rem;
}
.login-form__label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}
.login-form__input, .login-form__select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}
.login-form__button {
  width: 100%;
  padding: 0.75rem;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}
.login-form__button:hover {
  background-color: #c0392b;
}
`;
writeFile('src/styles/Login.css', loginCss);

const dashboardCss = `
.dashboard {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
.dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  border-bottom: 2px solid #ddd;
  padding-bottom: 1rem;
}
.dashboard__title {
  font-size: 2rem;
  color: #2c3e50;
}
.dashboard__logout {
  padding: 0.5rem 1rem;
  background-color: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}
.category-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s;
  border: 1px solid #eee;
}
.category-card:hover {
  transform: translateY(-5px);
  border-color: #3498db;
}
.category-card__title {
  font-size: 1.25rem;
  font-weight: bold;
  color: #34495e;
}
`;
writeFile('src/styles/Dashboard.css', dashboardCss);

const bottleListCss = `
.bottle-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.bottle-modal {
  background: white;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 8px;
  padding: 2rem;
  position: relative;
}
.bottle-modal__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}
.bottle-modal__title {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}
.bottle-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}
.bottle-item {
  background: #f9f9f9;
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
}
.bottle-item:hover {
  background: #ecf0f1;
  border-color: #bdc3c7;
}
.bottle-item--inactive {
  opacity: 0.5;
  background: #e0e0e0;
  cursor: not-allowed;
  pointer-events: none;
}
.bottle-item__name {
  font-weight: 500;
}
/* Form for specific bottle */
.bottle-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed #ccc;
}
.bottle-form__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bottle-form__input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 150px;
}
.bottle-form__summary {
  background: #dff9fb;
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
  font-weight: bold;
}
.bottle-form__actions {
  display: flex;
  gap: 1rem;
}
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.btn--save {
  background-color: #27ae60;
  color: white;
}
.btn--cancel {
  background-color: #e74c3c;
  color: white;
}
`;
writeFile('src/styles/BottleList.css', bottleListCss);

// --- 5. React Components ---

const LoginComp = `
'use client';
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { RESTAURANTS } from '../../lib/data';
import '../../styles/Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <h2 className="login-form__title">Bartender Login</h2>
        <div className="login-form__group">
          <label className="login-form__label">Email</label>
          <input 
            type="email" 
            className="login-form__input" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="bartender@negroamaro.com"
            required
          />
        </div>
        <div className="login-form__group">
          <label className="login-form__label">Password</label>
          <input 
            type="password" 
            className="login-form__input" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{color: 'red', textAlign: 'center'}}>{error}</p>}
        <button type="submit" className="login-form__button">Enter Dashboard</button>
      </form>
    </div>
  );
}
`;
writeFile('src/components/Login/Login.js', LoginComp);

const BottleFormComp = `
import React, { useState, useEffect } from 'react';

export default function BottleForm({ bottle, onSave, onCancel }) {
  const [openingWeight, setOpeningWeight] = useState(bottle.current_weight || 0);
  const [salesCount, setSalesCount] = useState(0);
  const [closingWeight, setClosingWeight] = useState(0);
  
  // Logic: Each drink is 1.5oz or 0.4 units. 
  // We assume user inputs weight in Grams or Oz.
  // If we follow the prompt strictly: Sales deduction = count * 0.4 (or 1.5)
  const UNIT_FACTOR = 0.4; // Can be changed to 1.5 if using Oz
  
  useEffect(() => {
    // Auto calculate closing weight suggestion based on sales
    const deduction = salesCount * UNIT_FACTOR;
    // This is just visual feedback, the user must manually enter closing weight per prompt
  }, [salesCount]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...bottle,
      current_weight: closingWeight, // Update current weight to closing
      last_sales: salesCount,
      last_updated: new Date()
    });
  };

  return (
    <form className="bottle-form" onSubmit={handleSubmit}>
      <h3>Update: {bottle.name}</h3>
      
      <div className="bottle-form__row">
        <label>Opening Weight:</label>
        <input 
          type="number" 
          step="0.01"
          className="bottle-form__input"
          value={openingWeight}
          onChange={(e) => setOpeningWeight(parseFloat(e.target.value))}
        />
      </div>

      <div className="bottle-form__row">
        <label>Drinks Sold Today:</label>
        <input 
          type="number" 
          className="bottle-form__input"
          value={salesCount}
          onChange={(e) => setSalesCount(parseInt(e.target.value))}
        />
      </div>
      
      <div className="bottle-form__summary">
        Estimated Consumption: {(salesCount * UNIT_FACTOR).toFixed(2)} units
      </div>

      <div className="bottle-form__row">
        <label>Final Weight (Closing):</label>
        <input 
          type="number" 
          step="0.01"
          className="bottle-form__input"
          value={closingWeight}
          onChange={(e) => setClosingWeight(parseFloat(e.target.value))}
          required
        />
      </div>

      <div className="bottle-form__actions">
        <button type="submit" className="btn btn--save">Save Stock</button>
        <button type="button" onClick={onCancel} className="btn btn--cancel">Cancel</button>
      </div>
    </form>
  );
}
`;
writeFile('src/components/BottleForm/BottleForm.js', BottleFormComp);

const DashboardComp = `
'use client';
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { BOTTLE_DATA } from '../../lib/data';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import BottleForm from '../BottleForm/BottleForm';
import '../../styles/Dashboard.css';
import '../../styles/BottleList.css';

export default function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBottle, setSelectedBottle] = useState(null);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);

  // Load Inventory from Firestore
  useEffect(() => {
    const loadData = async () => {
      // We assume one document per restaurant for simplicity in this demo
      // In production, you might use a subcollection
      if (!auth.currentUser) return;
      
      const restId = auth.currentUser.uid; 
      const docRef = doc(db, "inventories", restId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setInventory(docSnap.data());
      } else {
        // Initialize if empty
        setInventory({}); 
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleBottleClick = (bottleName) => {
    // Check if bottle exists in inventory, if not create default
    const bottleData = inventory[bottleName] || { 
      name: bottleName, 
      active: true, // Default active
      current_weight: 0 
    };
    
    // Logic: If prompt says inactive are grayed out, we check 'active' status
    // For this demo, let's assume all are active unless explicitly set to false in DB
    if (bottleData.active === false) return;

    setSelectedBottle(bottleData);
  };

  const saveBottleData = async (updatedBottle) => {
    const restId = auth.currentUser.uid;
    const newInventory = {
      ...inventory,
      [updatedBottle.name]: updatedBottle
    };
    
    setInventory(newInventory);
    setSelectedBottle(null); // Close modal
    
    // Save to Firebase
    await setDoc(doc(db, "inventories", restId), newInventory, { merge: true });
  };

  if (loading) return <div>Loading stock...</div>;

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__title">Stock Manager</h1>
        <button className="dashboard__logout" onClick={() => signOut(auth)}>Logout</button>
      </header>

      {/* 1. Category Grid */}
      {!selectedCategory && (
        <div className="dashboard__grid">
          {Object.keys(BOTTLE_DATA).map(cat => (
            <div 
              key={cat} 
              className="category-card"
              onClick={() => setSelectedCategory(cat)}
            >
              <h2 className="category-card__title">{cat}</h2>
            </div>
          ))}
        </div>
      )}

      {/* 2. Bottle Grid (Modal Overlay Style for Category) */}
      {selectedCategory && !selectedBottle && (
        <div className="bottle-overlay">
          <div className="bottle-modal">
            <button className="bottle-modal__close" onClick={() => setSelectedCategory(null)}>X</button>
            <h2 className="bottle-modal__title">{selectedCategory}</h2>
            
            <div className="bottle-list">
              {BOTTLE_DATA[selectedCategory].map(bottleName => {
                const isInactive = inventory[bottleName]?.active === false;
                return (
                  <div 
                    key={bottleName} 
                    className={\`bottle-item \${isInactive ? 'bottle-item--inactive' : ''}\`}
                    onClick={() => handleBottleClick(bottleName)}
                  >
                    <span className="bottle-item__name">{bottleName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Bottle Edit Form */}
      {selectedBottle && (
        <div className="bottle-overlay">
          <div className="bottle-modal">
            <BottleForm 
              bottle={selectedBottle} 
              onSave={saveBottleData}
              onCancel={() => setSelectedBottle(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
`;
writeFile('src/components/Dashboard/Dashboard.js', DashboardComp);

// --- 6. Main App Pages ---

const layoutPage = `
import '../styles/global.css';

export const metadata = {
  title: 'Bartender Stock App',
  description: 'Manage restaurant inventory',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
writeFile('src/app/layout.js', layoutPage);

const mainPage = `
'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Login from '../components/Login/Login';
import Dashboard from '../components/Dashboard/Dashboard';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Login />;
  }

  return <Dashboard />;
}
`;
writeFile('src/app/page.js', mainPage);

console.log("Project setup complete!");
console.log("1. Run 'npm install'");
console.log("2. Update 'src/lib/firebase.js' with your Firebase keys.");
console.log("3. Run 'npm run dev'");