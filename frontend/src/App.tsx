import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Workspace from './pages/Workspace';
import WorkspaceList from './pages/WorkspaceList';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="h-full">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/workspaces" element={
              <PrivateRoute>
                <WorkspaceList />
              </PrivateRoute>
            } />
            <Route path="/workspace/:workspaceId/channel/:channelId" element={
              <PrivateRoute>
                <Workspace />
              </PrivateRoute>
            } />
            <Route path="/workspace/:workspaceId" element={
              <PrivateRoute>
                <Workspace />
              </PrivateRoute>
            } />
            <Route path="/" element={<Navigate to="/workspaces" replace />} />
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#333',
                color: '#fff',
              },
            }}
          />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
