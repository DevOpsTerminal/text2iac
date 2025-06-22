import React, { useState } from 'react';
import axios from 'axios';

const RequestForm = () => {
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('development');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [requestId, setRequestId] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

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
            className="btn"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RequestForm;
