import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';

const FileUpload = ({ onUpload }) => {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token'); // Basic auth check
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      if (data.success) {
        onUpload(data);
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: '2px dashed #e5e7eb',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backgroundColor: isDragActive ? '#f0f9ff' : '#ffffff',
        borderColor: isDragActive ? '#0284c7' : '#e5e7eb',
        outline: 'none'
      }}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #0284c7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#6b7280', margin: 0 }}>Processing PDF...</p>
        </div>
      ) : (
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📄</div>
          {isDragActive ? (
            <p style={{ color: '#0284c7', fontWeight: '600', margin: 0 }}>Drop the PDF here...</p>
          ) : (
            <div>
              <p style={{ color: '#374151', fontWeight: '600', marginBottom: '0.5rem' }}>
                Click to upload or drag and drop
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                PDF files only, max 10MB
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default FileUpload;
