import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import axios from 'axios';

// IMPORTANT: Assuming you have a way to get the auth token,
// such as from a global state or a context API.
// This is a placeholder for demonstration.
const getAuthToken = () => {
  // Replace this with your actual token retrieval logic.
  // Example: return localStorage.getItem('token');
  return 'your_authentication_token_here';
};

const FileUpload = ({ onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file only');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // FIXED: Use the live backend URL
      const { data } = await axios.post('https://childactor101.sbs/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          // CRITICAL FIX: Add the authentication header to fix the 401 error
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      });

      // FIXED: Handle the new response format from simple backend
      if (!data?.success || !data?.uploadId) {
        throw new Error(data?.error || 'Upload failed');
      }

      // Show file info in the UI
      setUploadedFile({
        name: data.filename || file.name,
        size: formatFileSize(file.size),
        extractionMethod: data.extractionMethod,
        confidence: data.extractionConfidence,
        characterNames: data.characterNames || [],
      });

      // Pass the upload data to Dashboard
      onUpload({
        uploadId: data.uploadId,
        filename: data.filename || file.name,
        textLength: data.textLength ?? 0,
        wordCount: data.wordCount ?? 0,
        extractionMethod: data.extractionMethod,
        extractionConfidence: data.extractionConfidence,
        characterNames: data.characterNames || [],
        preview: data.preview,
      });

      // Show enhanced success message
      const methodText = data.extractionMethod === 'adobe' ? 'Adobe Premium OCR' : 'Basic OCR';
      toast.success(`PDF processed successfully using ${methodText}!`);
      
      // Show character names if found
      if (data.characterNames && data.characterNames.length > 0) {
        toast.success(`Found ${data.characterNames.length} character name(s): ${data.characterNames.slice(0, 3).join(', ')}`);
      }

    } catch (err) {
      console.error('Upload error:', err);
      // More robust error handling for user feedback
      const errorMessage = err.response?.status === 401 
        ? 'Authentication failed. Please log in again.' 
        : err.response?.data?.error || err.message || 'Failed to upload file';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h3 style={{
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        📄 Upload Your Audition Sides
      </h3>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Upload your audition script in PDF format. We'll extract the text and analyze it for your professional acting guide.
      </p>

      <div
        {...getRootProps()}
        style={{
          border: `3px dashed ${isDragActive ? '#06b6d4' : '#cbd5e0'}`,
          borderRadius: '1rem',
          padding: '3rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? '#ecfeff' : '#f8fafc',
          transition: 'all 0.3s ease',
        }}
        onMouseOver={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.borderColor = '#2dd4bf';
            e.currentTarget.style.background = '#f0fdfa';
          }
        }}
        onMouseOut={(e) => {
          if (!isDragActive) {
            e.currentTarget.style.borderColor = '#cbd5e0';
            e.currentTarget.style.background = '#f8fafc';
          }
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #d1fae5',
              borderTop: '4px solid #14b8a6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }} />
            <p style={{ color: '#6b7280' }}>
              Processing your PDF with advanced OCR...
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              Extracting text and analyzing script structure
            </p>
          </div>
        ) : uploadedFile ? (
          <div style={{ color: '#059669' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              {uploadedFile.name}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {uploadedFile.size}
            </p>
            {uploadedFile.extractionMethod && (
              <div style={{ 
                marginTop: '1rem',
                padding: '0.5rem',
                background: uploadedFile.extractionMethod === 'adobe' ? '#d1fae5' : '#fef3c7',
                borderRadius: '0.5rem',
                fontSize: '0.875rem'
              }}>
                <span style={{ 
                  fontWeight: 600,
                  color: uploadedFile.extractionMethod === 'adobe' ? '#059669' : '#d97706'
                }}>
                  {uploadedFile.extractionMethod === 'adobe' ? '🔍 Adobe Premium OCR' : '📖 Basic OCR'}
                </span>
                <br />
                <span style={{ color: '#6b7280' }}>
                  {uploadedFile.confidence} confidence
                </span>
              </div>
            )}
            {uploadedFile.characterNames && uploadedFile.characterNames.length > 0 && (
              <div style={{ 
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: '#ede9fe',
                borderRadius: '0.5rem',
                fontSize: '0.875rem'
              }}>
                <span style={{ fontWeight: 600, color: '#7c3aed' }}>
                  Characters found: {uploadedFile.characterNames.slice(0, 3).join(', ')}
                  {uploadedFile.characterNames.length > 3 && ` +${uploadedFile.characterNames.length - 3} more`}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '4rem', color: '#9ca3af', marginBottom: '1rem' }}>📁</div>
            <p style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              {isDragActive ? 'Drop your PDF here' : 'Click to upload or drag and drop'}
            </p>
            <p style={{ color: '#6b7280' }}>
              PDF audition sides only, max 10MB
            </p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Advanced OCR will extract text and identify characters automatically
            </p>
          </div>
        )}
      </div>

      {/* Add spinning keyframes for loading animation */}
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
