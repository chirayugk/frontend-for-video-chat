import React, { useState } from 'react';
import { authApi } from '../api';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // or register
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    try {
      const url = mode === 'login' ? '/login' : '/register';
      const payload = mode === 'login' ? { email, password } : { email, password, name };
      const res = await authApi.post(url, payload);
      onLogin(res.data.token, res.data.user);
    } catch (e) {
      setErr(e.response?.data?.msg || 'Error');
    }
  };

  return (
    <div className="login">
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} required />
        )}
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button type="submit">{mode === 'login' ? 'Login' : 'Register'}</button>
      </form>
      <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Create an account' : 'Have an account? Login'}
      </button>
      {err && <div className="error">{err}</div>}
    </div>
  );
}
