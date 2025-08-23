
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import GuideForm from '../components/GuideForm';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard = () => {
  const [uploadData, setUploadData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();

  const handleFileUpload = (data) => {
    setUploadData(data);
    toast.success('PDF processed - ready to generate guide!');
  };

  const handleGenerateGuide = async (formData) => {
  try {
    setIsGenerating(true);
    console.log('🎭 Frontend: Starting guide generation...');
    console.log('📊 Frontend: Form data:', formData);
    console.log('📊 Frontend: Upload ID:', uploadData.uploadId);
    
    const response = await fetch('https://childactor101.sbs/api/guides/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadId: uploadData.uploadId,
        ...formData
      }),
    });

    console.log('📡 Frontend: Response status:', response.status);
    console.log('📡 Frontend: Response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate guide');
    }

    const data = await response.json();
    console.log('✅ Frontend: Guide data received:', !!data.guideContent);
    console.log('📄 Frontend: Guide content length:', data.guideContent?.length);

    // Open the guide in a new tab
    if (data.guideContent) {
      console.log('🚀 Frontend: Opening new window...');
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(data.guideContent);
        newWindow.document.close();
        console.log('✅ Frontend: Guide opened in new tab');
      } else {
        console.log('❌ Frontend: Popup blocked - check popup blocker');
        alert('Guide generated! Please check your popup blocker.');
      }
      toast.success('Acting guide opened in new tab!');
    }

  } catch (error) {
    console.error('❌ Frontend: Generation error:', error);
    toast.error('Failed to generate guide: ' + error.message);
  } finally {
    setIsGenerating(false);
  }
};
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #1d4ed8 100%)',
      paddingTop: '80px',
      paddingBottom: '2rem',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 80px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb',
          }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem' }}>
              Dashboard
            </h1>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Upload audition sides and generate professional acting guides
            </p>
          </div>

          <div style={{ padding: '2rem' }}>
            {isGenerating ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <LoadingSpinner />
                <p style={{ marginTop: '1rem', color: '#6b7280' }}>
                  Generating your professional acting guide...
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <FileUpload onUpload={handleFileUpload} />
                
                {uploadData && (
                  <div style={{ padding: '15px', background: '#f0fdfa', borderRadius: '10px', border: '1px solid #2dd4bf' }}>
                    ✅ Script ready: {uploadData.filename} ({uploadData.textLength || 0} characters)
                  </div>
                )}

                <GuideForm
                  onSubmit={handleGenerateGuide}
                  hasFile={!!uploadData}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;