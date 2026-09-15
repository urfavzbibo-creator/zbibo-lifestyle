import React, { useState } from 'react';
import { extractRotaFromImage } from './RotaOCR';

export default function RotaOCR({ onScheduleExtracted }) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [debugText, setDebugText] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setProgress(0);
    setFileName(file.name);
    setError('');
    setDebugText('Scanning image... please wait.');

    try {
      const result = await extractRotaFromImage(file, ({ status, progress: nextProgress = 0 }) => {
        setScanStatus(status);
        setProgress(Math.round(nextProgress * 100));
      });

      setDebugText(result.text || 'No raw OCR text returned.');
      if (!result.shifts.length) {
        throw new Error('The scanner could not find Ahmed Zbibo or HR ID 5680 across seven day cells.');
      }

      onScheduleExtracted(result);
      setScanStatus(`${result.shifts.length}/7 day cells recovered`);
    } catch (scanError) {
      setError(scanError.message || 'Error reading image.');
      setScanStatus('Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="rota-scanner">
      <label className="dropzone scanner-dropzone">
        <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isScanning} />
        <span className="upload-icon" aria-hidden="true">{isScanning ? '...' : '+'}</span>
        <strong>{isScanning ? 'Scanning your rota...' : 'Drop a rota image here'}</strong>
        <span>{fileName || '974 x 993 table images are supported'}</span>
      </label>

      {isScanning && <div className="scanner-progress" aria-live="polite">
        <div className="scanner-progress-top"><span>{scanStatus || 'Preparing scanner'}</span><strong>{progress}%</strong></div>
        <div className="scanner-progress-track"><span style={{ width: `${Math.max(progress, 4)}%` }} /></div>
      </div>}

      {scanStatus && !isScanning && <p className="progress-message">{scanStatus}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}

      <details className="ocr-diagnostic">
        <summary>Scanner diagnostic output</summary>
        <pre>{debugText || 'Awaiting image...'}</pre>
      </details>
    </div>
  );
}
