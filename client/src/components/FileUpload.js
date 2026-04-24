import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import API_BASE from '../config/api';
import { withApiCredentials } from '../utils/apiAuth';

const DIRECT_API_BASE = 'https://prep101-api.vercel.app';
const MAX_FILES = 2;

const isLegacyFallbackMessage = (value = '') =>
  /limited script text detected|upload clearer sides for line-specific detail/i.test(
    String(value || '')
  );

const sanitizeWarnings = (warnings = []) =>
  (Array.isArray(warnings) ? warnings : []).filter(
    (warning) => !isLegacyFallbackMessage(warning)
  );

const parseResponseSafely = async (response) => {
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    return { ok: false, data: { error: `Empty response body (HTTP ${response.status})` } };
  }
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch (_error) {
    return {
      ok: false,
      data: {
        error: `Non-JSON response from upload service (HTTP ${response.status})`,
        raw: raw.slice(0, 180),
      },
    };
  }
};

const uploadSingleFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const uploadUrl = `${API_BASE}/api/upload`;
  const fallbackUrl = `${DIRECT_API_BASE}/api/upload`;
  const canFallback = uploadUrl !== fallbackUrl;

  const requestInit = {
    method: 'POST',
    ...withApiCredentials(),
    body: formData,
  };

  let response = await fetch(uploadUrl, requestInit);
  let parsed = await parseResponseSafely(response);

  if (!parsed.ok && canFallback) {
    response = await fetch(fallbackUrl, {
      method: 'POST',
      body: formData,
      credentials: 'omit',
      mode: 'cors',
    });
    parsed = await parseResponseSafely(response);
  }

  const data = parsed.data || {};

  if (!response.ok) {
    throw new Error(data.error || data.message || `Upload failed (HTTP ${response.status})`);
  }
  if (!parsed.ok) {
    throw new Error(data.error || 'Upload failed to return valid JSON');
  }
  if (!data.success) {
    throw new Error(data.error || data.message || 'Upload failed');
  }

  return data;
};

const FileUpload = ({ onUpload, onUploadStart, onUploadEnd, allowMultiple = false }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]); // [{name, wordCount}]

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    const files = acceptedFiles.slice(0, MAX_FILES);

    for (const file of files) {
      if (file.type !== 'application/pdf') {
        toast.error(`"${file.name}" is not a PDF — only PDF files are supported.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" is too large — max 10MB per file.`);
        return;
      }
    }

    if (typeof onUploadStart === 'function') {
      onUploadStart(files[0]);
    }

    setUploading(true);
    setUploadedFiles([]);

    const toastId = toast.loading(
      files.length > 1 ? `Processing ${files.length} PDFs…` : 'Processing PDF…'
    );

    let uploadSucceeded = false;

    try {
      const results = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (files.length > 1) {
          toast.loading(`Processing file ${i + 1} of ${files.length}: ${file.name}`, { id: toastId });
        }
        const data = await uploadSingleFile(file);
        results.push({ file, data });
      }

      // Merge all results into one combined payload
      const allUploadIds = [];
      const allSceneTexts = [];
      const allCharacterNames = [];
      const allWarnings = [];
      let totalWordCount = 0;
      let combinedScenePayloads = {};
      let anyFallback = false;

      for (const { file, data } of results) {
        const sceneText = data.sceneText || data.text || '';
        const ids = data.uploadIds || (data.uploadId ? [data.uploadId] : []);
        const primaryId = data.uploadId || ids[0] || null;

        allUploadIds.push(...ids);
        if (sceneText) {
          allSceneTexts.push(
            results.length > 1 ? `--- FILE: ${file.name} ---\n${sceneText}` : sceneText
          );
        }
        allCharacterNames.push(...(data.characterNames || []));
        allWarnings.push(...sanitizeWarnings(data.warnings));
        totalWordCount += Number(data.wordCount || 0);
        if (data.fallbackMode) anyFallback = true;

        if (primaryId && sceneText) {
          combinedScenePayloads[primaryId] = {
            filename: data.filename || data.originalName || file.name,
            sceneText,
            characterNames: data.characterNames || [],
            extractionMethod: data.extractionMethod || 'upload',
            extractionConfidence: data.extractionConfidence || 'unknown',
            wordCount: data.wordCount || 0,
            pageCount: data.pageCount || null,
            fileType: data.fileType || 'sides',
            fallbackMode: Boolean(data.fallbackMode),
            warnings: sanitizeWarnings(data.warnings),
            source: data.source || data.extractionMethod || 'text',
          };
        }
        if (data.scenePayloads) {
          combinedScenePayloads = { ...combinedScenePayloads, ...data.scenePayloads };
        }
      }

      const mergedSceneText = allSceneTexts.join('\n\n');
      const uniqueCharacterNames = [...new Set(allCharacterNames)];
      const primaryUploadId = allUploadIds[0] || null;

      setUploadedFiles(results.map(({ file, data }) => ({
        name: file.name,
        wordCount: Number(data.wordCount || 0),
      })));

      const firstData = results[0].data;
      const sanitizedUploadMessage = isLegacyFallbackMessage(firstData.uploadMessage)
        ? null
        : firstData.uploadMessage;

      onUpload({
        ...firstData,
        localFile: files[0],
        localFiles: files,
        uploadMessage: sanitizedUploadMessage,
        warnings: allWarnings,
        filename: files.map(f => f.name).join(' + '),
        sceneText: mergedSceneText,
        uploadId: primaryUploadId,
        uploadIds: allUploadIds,
        scenePayloads: combinedScenePayloads,
        characterNames: uniqueCharacterNames,
        wordCount: totalWordCount,
        fallbackMode: anyFallback,
        multiFile: files.length > 1,
        fileCount: files.length,
      });

      const label = files.length > 1
        ? `${files.length} PDFs processed — ${totalWordCount} words total.`
        : `PDF processed — ${totalWordCount} words extracted.`;

      if (sanitizedUploadMessage) {
        toast(sanitizedUploadMessage, { id: toastId, icon: '🧠', duration: 5000 });
      } else if (anyFallback || firstData.scriptReadable === false) {
        toast(
          'PDF uploaded, but the text layer looks incomplete or watermark-heavy. We will use recovery reading during generation.',
          { id: toastId, icon: '⚠️', duration: 7000 }
        );
      } else {
        toast.success(label, { id: toastId });
      }

      uploadSucceeded = true;
    } catch (error) {
      console.error('📋 PDF Upload Diagnostic:', error);
      toast.error(error.message || 'Failed to upload file. Please try again.', { id: toastId });
      setUploadedFiles([]);
    } finally {
      setUploading(false);
      if (typeof onUploadEnd === 'function') {
        onUploadEnd(uploadSucceeded);
      }
    }
  }, [onUpload, onUploadStart, onUploadEnd, allowMultiple]);

  const maxFiles = allowMultiple ? MAX_FILES : 1;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: allowMultiple,
    maxFiles,
  });

  return (
    <div>
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
          borderColor: isDragActive ? '#0284c7' : uploadedFiles.length > 0 ? '#10b981' : '#e5e7eb',
          outline: 'none',
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
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ color: '#6b7280', margin: 0 }}>Processing PDF{allowMultiple ? 's' : ''}…</p>
          </div>
        ) : (
          <div style={{ pointerEvents: 'none' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
              {uploadedFiles.length > 0 ? '✅' : allowMultiple ? '📄📄' : '📄'}
            </div>
            {isDragActive ? (
              <p style={{ color: '#0284c7', fontWeight: '600', margin: 0 }}>
                Drop {allowMultiple ? 'PDFs' : 'the PDF'} here…
              </p>
            ) : (
              <div>
                <p style={{ color: '#374151', fontWeight: '600', marginBottom: '0.5rem' }}>
                  {uploadedFiles.length > 0
                    ? 'Click to replace or drag new files'
                    : 'Click to upload or drag and drop'}
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                  {allowMultiple
                    ? `Up to ${MAX_FILES} PDF files · max 10MB each`
                    : 'PDF files only, max 10MB'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Uploaded file pills */}
      {uploadedFiles.length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {uploadedFiles.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#ecfdf5',
                border: '1px solid #6ee7b7',
                borderRadius: '999px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.8rem',
                color: '#065f46',
              }}
            >
              <span>📄</span>
              <span style={{ fontWeight: 600 }}>{f.name}</span>
              {f.wordCount > 0 && (
                <span style={{ color: '#047857' }}>· {f.wordCount} words</span>
              )}
            </div>
          ))}
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
