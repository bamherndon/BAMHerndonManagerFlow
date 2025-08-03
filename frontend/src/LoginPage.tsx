// frontend/src/LoginPage.tsx
import React, { useEffect, useState } from 'react';

export default function LoginPage() {
  const [code, setCode] = useState<string | null>(null);

  // Replace these with your own environment variables in .env (Vite will expose VITE_*)
  const clientId    = import.meta.env.VITE_HEARTLAND_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_HEARTLAND_REDIRECT_URI;
  const authUrlBase = 'https://retail.heartland.us/oauth/authorize';

  useEffect(() => {
    // On callback, Heartland will redirect here with ?code=...
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) setCode(c);
  }, []);

  const startLogin = () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'item.manage inventory.transfer.read', // adjust scopes as needed
      state: Math.random().toString(36).substring(2),
    });
    window.location.href = `${authUrlBase}?${params.toString()}`;
  };

  return (
    <div className="p-4 max-w-md mx-auto text-center">
      <h2 className="text-2xl font-bold mb-4">Login to Heartland</h2>
      {code ? (
        <div>
          <p className="mb-2">🎉 OAuth code received:</p>
          <code className="block bg-gray-100 p-2 rounded">{code}</code>
          <p className="mt-4">Next: exchange this code for an access token.</p>
        </div>
      ) : (
        <button
          onClick={startLogin}
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-500"
        >
          Start OAuth Login
        </button>
      )}
    </div>
  );
}
