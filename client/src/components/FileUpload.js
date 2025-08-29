import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import API_BASE from '../config/api';

const FileUpload = ({ onUpload }) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileType, setFileType] = useState('sides'); // 'sides' or 'full_script'


  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    // Validate all files
    const invalidFiles = acceptedFiles.filter(file => file.type !== 'application/pdf');
    if (invalidFiles.length > 0) {
      toast.error(`Please upload PDF files only. Found ${invalidFiles.length} invalid file(s).`);
      return;
    }

    const oversizedFiles = acceptedFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`Some files are too large. Max size is 10MB per file.`);
      return;
    }

    setUploading(true);
    
    try {
      const uploadResults = [];
      let totalTextLength = 0;
      let totalWordCount = 0;
      const allCharacterNames = new Set();
      let combinedPreview = '';

      // Upload files sequentially to avoid overwhelming the server
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        

        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', fileType); // Send file type to backend

        const { data } = await axios.post(`${API_BASE}/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${user?.accessToken || user?.token}`,
          },
        });

        if (!data?.success || !data?.uploadId) {
          throw new Error(data?.error || `Upload failed for ${file.name}`);
        }

        uploadResults.push({
          uploadId: data.uploadId,
          filename: data.filename || file.name,
          textLength: data.textLength ?? 0,
          wordCount: data.wordCount ?? 0,
          extractionMethod: data.extractionMethod,
          extractionConfidence: data.extractionConfidence,
          characterNames: data.characterNames || [],
          preview: data.preview,
          fileType: fileType // Include file type in upload data
        });

        totalTextLength += data.textLength ?? 0;
        totalWordCount += data.wordCount ?? 0;
        if (data.characterNames) {
          data.characterNames.forEach(name => allCharacterNames.add(name));
        }
        combinedPreview += (data.preview || '') + '\n\n';


      }

      // Update UI with all uploaded files
      setUploadedFiles(uploadResults.map(result => ({
        name: result.filename,
        size: formatFileSize(acceptedFiles.find(f => f.name === result.filename)?.size || 0),
        extractionMethod: result.extractionMethod,
        confidence: result.extractionConfidence,
        characterNames: result.characterNames || [],
        uploadId: result.uploadId,
        fileType: result.fileType
      })));

      // Pass combined upload data to Dashboard
      onUpload({
        uploadIds: uploadResults.map(r => r.uploadId),
        filenames: uploadResults.map(r => r.filename),
        textLength: totalTextLength,
        wordCount: totalWordCount,
        extractionMethod: uploadResults[0]?.extractionMethod || 'basic',
        extractionConfidence: uploadResults[0]?.extractionConfidence || 'high',
        characterNames: Array.from(allCharacterNames),
        preview: combinedPreview.trim(),
        fileCount: acceptedFiles.length,
        fileTypes: uploadResults.map(r => r.fileType) // Include all file types
      });

      // Show success message
      const methodText = uploadResults[0]?.extractionMethod === 'adobe' ? 'Adobe Premium OCR' : 'Basic OCR';
      const typeText = fileType === 'sides' ? 'audition sides' : 'full script';
      toast.success(`Successfully processed ${acceptedFiles.length} PDF${acceptedFiles.length > 1 ? 's' : ''} as ${typeText} using ${methodText}!`);
      
      if (allCharacterNames.size > 0) {
        toast.success(`Found ${allCharacterNames.size} character name(s): ${Array.from(allCharacterNames).slice(0, 3).join(', ')}`);
      }

    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err.response?.status === 401 
        ? 'Authentication failed. Please log in again.' 
        : err.response?.data?.error || err.message || 'Failed to upload files';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [onUpload, user?.accessToken, user?.token, fileType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
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
        Upload one or more audition PDFs (sides, character breakdowns, etc.). We'll combine and analyze all files to create your comprehensive acting guide.
      </p>

      {/* File Type Selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '0.875rem', 
          fontWeight: '600', 
          color: '#374151',
          marginBottom: '0.5rem'
        }}>
          File Type:
        </label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            cursor: 'pointer'
          }}>
            <input
              type="radio"
              name="fileType"
              value="sides"
              checked={fileType === 'sides'}
              onChange={(e) => setFileType(e.target.value)}
              style={{ margin: 0 }}
            />
            <span style={{ color: '#374151' }}>🎭 Audition Sides</span>
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            cursor: 'pointer'
          }}>
            <input
              type="radio"
              name="fileType"
              value="full_script"
              checked={fileType === 'full_script'}
              onChange={(e) => setFileType(e.target.value)}
              style={{ margin: 0 }}
            />
            <span style={{ color: '#374151' }}>📚 Full Script</span>
          </label>
        </div>
        <p style={{ 
          color: '#6b7280', 
          fontSize: '0.875rem', 
          marginTop: '0.5rem',
          fontStyle: 'italic'
        }}>
          {fileType === 'sides' 
            ? 'Upload the specific scenes you\'re auditioning for'
            : 'Upload the complete script for broader context and character insights'
          }
        </p>
      </div>

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
        ) : uploadedFiles.length > 0 ? (
          <div style={{ color: '#059669' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              {uploadedFiles.length} PDF{uploadedFiles.length > 1 ? 's' : ''} uploaded successfully
            </p>
            
            {uploadedFiles.map((file, index) => (
              <div key={index} style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                textAlign: 'left'
              }}>
                <div style={{ fontWeight: 600, color: '#166534', marginBottom: '0.25rem' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  {file.size}
                </div>
                {file.extractionMethod && (
                  <div style={{ 
                    padding: '0.25rem 0.5rem',
                    background: file.extractionMethod === 'adobe' ? '#d1fae5' : '#fef3c7',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    display: 'inline-block',
                    marginRight: '0.5rem'
                  }}>
                    <span style={{ 
                      fontWeight: 600,
                      color: file.extractionMethod === 'adobe' ? '#059669' : '#d97706'
                    }}>
                      {file.extractionMethod === 'adobe' ? '🔍 Adobe OCR' : '📖 Basic OCR'}
                    </span>
                  </div>
                )}
                {file.fileType && (
                  <div style={{ 
                    padding: '0.25rem 0.5rem',
                    background: file.fileType === 'full_script' ? '#dbeafe' : '#fef3c7',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    display: 'inline-block',
                    marginRight: '0.5rem'
                  }}>
                    <span style={{ 
                      fontWeight: 600,
                      color: file.fileType === 'full_script' ? '#1d4ed8' : '#d97706'
                    }}>
                      {file.fileType === 'full_script' ? '📚 Full Script' : '🎭 Sides'}
                    </span>
                  </div>
                )}
                {file.characterNames && file.characterNames.length > 0 && (
                  <div style={{ 
                    padding: '0.25rem 0.5rem',
                    background: '#ede9fe',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    display: 'inline-block'
                  }}>
                    <span style={{ fontWeight: 600, color: '#7c3aed' }}>
                      {file.characterNames.length} character{file.characterNames.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
            
            {/* Combined stats */}
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#fef3c7',
              borderRadius: '0.5rem',
              fontSize: '0.875rem'
            }}>
              <span style={{ fontWeight: 600, color: '#d97706' }}>
                📊 Combined: {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} ready for guide generation
              </span>
            </div>
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
              {isDragActive ? 'Drop your PDFs here' : 'Click to upload or drag and drop'}
            </p>
            <p style={{ color: '#6b7280' }}>
              PDF audition files only, max 10MB per file
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
