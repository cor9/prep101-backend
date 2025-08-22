  const handleGenerateGuide = async (formData) => {
    if (!uploadId && !sceneText.trim()) {
      toast.error('Upload a PDF or paste scene text first');
      return;
    }

    setIsGenerating(true);

    try {
      // Fake successful guide generation
      toast.success('Guide generated successfully!');

      // Create a simple test guide HTML
      const testGuideHtml = `
        <html>
        <head><title>Acting Guide - ${formData.characterName}</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1>Acting Guide for ${formData.characterName}</h1>
          <h2>Production: ${formData.productionTitle}</h2>
          <h3>Type: ${formData.productionType}</h3>
          <p><strong>Character Insights:</strong></p>
          <p>This is a test guide. Your actual guide would contain detailed character analysis, scene breakdowns, and acting notes based on your uploaded script.</p>
          <p><strong>Key Scenes:</strong></p>
          <ul>
            <li>Scene analysis would appear here</li>
            <li>Character motivations and objectives</li>
            <li>Emotional beats and transitions</li>
          </ul>
        </body>
        </html>
      `;

      // Open the HTML in a new tab
      const win = window.open('', '_blank');
      win.document.open();
      win.document.write(testGuideHtml);
      win.document.close();

      // Reset inputs
      setUploadId(null);
      setSceneText('');
      
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate guide');
    } finally {
      setIsGenerating(false);
    }
  };
