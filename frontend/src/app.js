import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import './styles.css';

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Components
const Layout = ({ children }) => (
  <div className="min-h-screen bg-gray-50">
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">Text2IaC Platform</h1>
      </div>
    </header>
    <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      {children}
    </main>
    <footer className="bg-white mt-12 border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <p className="text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Text2IaC Platform. All rights reserved.
        </p>
      </div>
    </footer>
  </div>
);

const Home = () => {
  const [activeTab, setActiveTab] = useState('new');
  
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('new')}
            className={`${activeTab === 'new' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            New Request
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`${activeTab === 'status' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Check Status
          </button>
        </nav>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
        {activeTab === 'new' ? <RequestForm /> : <StatusDisplay />}
      </div>
    </div>
  );
};

const RequestForm = () => {
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('development');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [requestId, setRequestId] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!description.trim()) {
      setStatus({ type: 'error', message: 'Please enter a description' });
      return;
    }
    
    setIsSubmitting(true);
    setStatus({ type: 'info', message: 'Submitting your request...' });
    
    try {
      const response = await axios.post(`${API_BASE_URL}/infrastructure/requests`, {
        description,
        environment,
        priority,
      });
      
      setRequestId(response.data.id);
      setStatus({ 
        type: 'success', 
        message: 'Your request has been submitted successfully!' 
      });
      setDescription('');
    } catch (error) {
      console.error('Error submitting request:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to submit request. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-6">New Infrastructure Request</h2>
      
      {status.message && (
        <div className={`mb-4 p-4 rounded-md ${status.type === 'error' ? 'bg-red-50 text-red-700' : status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          {status.message}
          {requestId && (
            <div className="mt-2">
              Request ID: <span className="font-mono">{requestId}</span>
            </div>
          )}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Describe your infrastructure needs
          </label>
          <div className="mt-1">
            <textarea
              id="description"
              rows={6}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
              placeholder="Example: I need a new Kubernetes cluster with 3 nodes, 8GB RAM each, in the us-west-2 region."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="environment" className="block text-sm font-medium text-gray-700">
              Environment
            </label>
            <select
              id="environment"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
              Priority
            </label>
            <select
              id="priority"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

const StatusDisplay = () => {
  const [requestId, setRequestId] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [requestData, setRequestData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    
    if (!requestId.trim()) {
      setStatus({ type: 'error', message: 'Please enter a request ID' });
      return;
    }
    
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Fetching status...' });
    
    try {
      const response = await axios.get(`${API_BASE_URL}/infrastructure/requests/${requestId}`);
      setRequestData(response.data);
      setStatus({ type: 'success', message: 'Status retrieved successfully' });
    } catch (error) {
      console.error('Error fetching status:', error);
      setRequestData(null);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to fetch status. Please check the request ID and try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-6">Check Request Status</h2>
      
      <form onSubmit={handleCheckStatus} className="space-y-4">
        <div>
          <label htmlFor="requestId" className="block text-sm font-medium text-gray-700">
            Request ID
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              id="requestId"
              className="focus:ring-indigo-500 focus:border-indigo-500 flex-1 block w-full rounded-md sm:text-sm border-gray-300 p-2 border"
              placeholder="Enter your request ID"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Checking...' : 'Check Status'}
            </button>
          </div>
        </div>
      </form>
      
      {status.message && !requestData && (
        <div className={`mt-4 p-4 rounded-md ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {status.message}
        </div>
      )}
      
      {requestData && (
        <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Request Details
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Status and details of your infrastructure request
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Request ID
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">
                  {requestData.id}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Status
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    requestData.status === 'completed' ? 'bg-green-100 text-green-800' :
                    requestData.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {requestData.status.charAt(0).toUpperCase() + requestData.status.slice(1)}
                  </span>
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Environment
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {requestData.environment.charAt(0).toUpperCase() + requestData.environment.slice(1)}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Priority
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {requestData.priority.charAt(0).toUpperCase() + requestData.priority.slice(1)}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Created At
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {new Date(requestData.createdAt).toLocaleString()}
                </dd>
              </div>
              {requestData.updatedAt && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Last Updated
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {new Date(requestData.updatedAt).toLocaleString()}
                  </dd>
                </div>
              )}
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">
                  Description
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">
                  {requestData.description}
                </dd>
              </div>
              {requestData.output && (
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Output
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-xs">
                      <code>{JSON.stringify(requestData.output, null, 2)}</code>
                    </pre>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/status/:id" element={<StatusDisplay />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
