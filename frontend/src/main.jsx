import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

console.log('🚀 main.jsx 已加载');

const root = ReactDOM.createRoot(document.getElementById('root'));

// 始终禁用 StrictMode
console.log('⚙️ 渲染应用（禁用 StrictMode）');
root.render(<App />);
