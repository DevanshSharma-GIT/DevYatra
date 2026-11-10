import dynamic from 'next/dynamic';
import React from 'react';

// Define the Props interface needed by the component
interface QRCodeProps {
  value: string;
  size: number;
}

// The outer function passed to dynamic must return a Promise that resolves to a React component.
// We use a simplified arrow function syntax to implicitly return the component.
const DynamicQRCode = dynamic<QRCodeProps>(
  async () => {
    // This import runs only in the browser
    const { QRCodeSVG } = await import('qrcode.react');
    
    // Return a functional component that accepts the props and renders QRCodeSVG.
    // We explicitly cast the returned functional component to resolve TypeScript errors.
    const Component = ({ value, size }: QRCodeProps) => (
        <QRCodeSVG value={value} size={size} level="M" />
    );

    // Casting it to a React.ComponentType ensures the dynamic import succeeds
    return Component as React.ComponentType<QRCodeProps>;

  },
  {
    ssr: false, // CRITICAL: Forces client-side rendering
    loading: () => <div className="text-center p-4 text-sm text-gray-500">Loading QR Code...</div>,
  }
);

export default DynamicQRCode;
