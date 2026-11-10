"use client"
import React, { useState, useEffect } from 'react';

interface Memory {
  id: number;
  lat: number | null;
  lon: number | null;
  location_name: string;
  ipfs_cid: string;
  points_earned: number;
}

const MemoriesPage: React.FC = () => {
  const [username] = useState<string>('testuser'); // Static for demo; replace with auth logic
  const [memories, setMemories] = useState<Memory[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>('Checking...');
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [ipfsHash, setIpfsHash] = useState<string | null>(null); // Add state for IPFS hash
  const [isLoading, setIsLoading] = useState<boolean>(false); // Add loading state

  // Check Pinata connection health on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then((res) => res.json())
      .then((data) => {
        setHealthStatus(data.pinata === 'connected' ? 'Connected' : 'Disconnected');
      })
      .catch(() => setHealthStatus('Error'));
  }, []);

  // Fetch memories on mount or username change
  useEffect(() => {
    fetch(`http://localhost:5000/api/memories/${username}`)
      .then((res) => res.json())
      .then((data) => setMemories(data))
      .catch((err) => console.error('Error fetching memories:', err));
  }, [username]);

  // Handle image upload
  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true); // Set loading state
    const formData = new FormData();
    formData.append('image', file);
    formData.append('username', username);

    fetch('http://localhost:5000/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setUploadMessage(`Error: ${data.error}`);
        } else {
          setUploadMessage(`Uploaded! Points: ${data.points_earned}`);
          // Store IPFS hash for display
          setIpfsHash(data.ipfs_cid);
          // Refresh memories
          fetch(`http://localhost:5000/api/memories/${username}`)
            .then((res) => res.json())
            .then((data) => setMemories(data));
        }
      })
      .catch((err) => {
        console.error('Upload error:', err);
        setUploadMessage('Upload failed');
      })
      .finally(() => {
        setIsLoading(false); // Clear loading state
      });
  };

  // Handle image viewing
  const viewImage = (memoryId: number) => {
    setIsLoading(true); // Set loading state
    console.log(`Fetching image for memory ID: ${memoryId}`); // Debug log
    
    fetch(`http://localhost:5000/api/memories/${username}/${memoryId}/image`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('Image data received:', data); // Debug log
        if (data.access_link) {
          setImageUrl(data.access_link);
        } else {
          console.error('No access link in response:', data);
          setUploadMessage('Error: Could not retrieve image link');
        }
      })
      .catch((err) => {
        console.error('Error fetching image:', err);
        setUploadMessage(`Error fetching image: ${err.message}`);
      })
      .finally(() => {
        setIsLoading(false); // Clear loading state
      });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#2c3e50', color: 'white', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Memories for {username}</h1>
        <p style={{ margin: '5px 0 0', fontSize: '14px' }}>
          Pinata Status: <span style={{ color: healthStatus === 'Connected' ? '#27ae60' : '#c0392b' }}>{healthStatus}</span>
        </p>
      </header>

      {/* Upload Section */}
      <section style={{ backgroundColor: '#ecf0f1', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ color: '#34495e', marginTop: 0 }}>Upload a Memory</h2>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          style={{ display: 'block', margin: '10px auto' }}
          disabled={isLoading}
        />
        {uploadMessage && (
          <p style={{ color: uploadMessage.includes('Error') ? '#c0392b' : '#27ae60', textAlign: 'center' }}>
            {uploadMessage}
          </p>
        )}
        
        {/* Display IPFS hash if available */}
        {ipfsHash && (
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '5px', border: '1px solid #bdc3c7' }}>
            <p style={{ fontSize: '14px', color: '#7f8c8d', margin: '0 0 5px' }}>IPFS Hash (CID):</p>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <code style={{ 
                backgroundColor: '#f7f9fa', 
                padding: '8px', 
                borderRadius: '4px', 
                fontSize: '12px',
                overflowX: 'auto',
                flex: 1,
                wordBreak: 'break-all'
              }}>
                {ipfsHash}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(ipfsHash);
                  setUploadMessage('IPFS hash copied to clipboard!');
                }}
                style={{
                  marginLeft: '10px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Copy
              </button>
            </div>
          </div>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ color: '#7f8c8d' }}>Processing... Please wait.</p>
          </div>
        )}
      </section>

      {/* Memories Section */}
      <section style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2 style={{ color: '#34495e', marginTop: 0 }}>Your Memories</h2>
        {memories.length === 0 ? (
          <p style={{ color: '#7f8c8d', textAlign: 'center' }}>No memories yet. Upload some!</p>
        ) : (
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {memories.map((memory) => (
              <li
                key={memory.id}
                style={{
                  backgroundColor: 'white',
                  padding: '15px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <strong style={{ color: '#2c3e50' }}>{memory.location_name}</strong> - Points: {memory.points_earned}
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '5px' }}>
                    IPFS CID: <code style={{ backgroundColor: '#f7f9fa', padding: '2px 4px', borderRadius: '3px' }}>{memory.ipfs_cid.substring(0, 15)}...</code>
                  </div>
                </span>
                <button
                  onClick={() => viewImage(memory.id)}
                  style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                  disabled={isLoading}
                >
                  View Image
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Image Preview */}
      {imageUrl && (
        <section style={{ backgroundColor: '#ecf0f1', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ color: '#34495e', marginTop: 0 }}>Image Preview</h3>
          <img
            src={imageUrl}
            alt="Memory"
            style={{ maxWidth: '100%', borderRadius: '5px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}
            onError={(e) => {
              console.error('Image failed to load');
              setUploadMessage('Error: Image failed to load');
              e.currentTarget.style.display = 'none';
            }}
          />
          <div style={{ marginTop: '10px' }}>
            <a 
              href={imageUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                backgroundColor: '#2980b9',
                color: 'white',
                textDecoration: 'none',
                padding: '8px 15px',
                borderRadius: '5px',
                fontSize: '14px'
              }}
            >
              Open in New Tab
            </a>
          </div>
        </section>
      )}
    </div>
  );
};

export default MemoriesPage;
