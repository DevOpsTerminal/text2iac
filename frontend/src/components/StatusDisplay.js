import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const StatusDisplay = () => {
  const { id: paramId } = useParams();
  const [requestId, setRequestId] = useState(paramId || '');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [requestData, setRequestData] = useState(null);
  const [isLoading, setIsLoading] = useState(!!paramId);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

  const fetchRequestStatus = async (id) => {
    if (!id.trim()) {
      setStatus({ type: 'error', message: 'Please enter a request ID' });
      return;
    }
    
    setIsLoading(true);
    setStatus({ type: 'info', message: 'Fetching status...' });
    
    try {
      const response = await axios.get(`${API_BASE_URL}/infrastructure/requests/${id}`);
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

  const handleCheckStatus = (e) => {
    e.preventDefault();
    fetchRequestStatus(requestId);
  };

  // Auto-fetch if request ID is provided in URL
  useEffect(() => {
    if (paramId) {
      fetchRequestStatus(paramId);
    }
  }, [paramId]);

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
              disabled={isLoading || !requestId.trim()}
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
      
      {isLoading && (
        <div className="mt-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
          
          {requestData.status === 'pending' && (
            <div className="bg-blue-50 px-4 py-3 sm:px-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h2a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800">
                    Your request is being processed. This page will automatically update when there are changes.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {requestData.status === 'failed' && (
            <div className="bg-red-50 px-4 py-3 sm:px-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    There was an error processing your request. Please try again or contact support.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;
