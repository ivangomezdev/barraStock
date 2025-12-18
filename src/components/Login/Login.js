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