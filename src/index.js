import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
// #design opens a demo harness for checking layout without a login.
// Dev only — the branch (and the import) is dropped from the production build.
let Root = App;
if (process.env.NODE_ENV === 'development' && window.location.hash === '#design') {
  Root = require('./DesignPreview').default;
}
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
