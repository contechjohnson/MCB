export default function HomePage() {
  return (
    <div style={{
      maxWidth: '800px',
      margin: '100px auto',
      padding: '40px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '16px', fontWeight: '600' }}>
        MCB Data Collection System
      </h1>
      <p style={{ marginBottom: '24px', color: '#666', lineHeight: '1.6' }}>
        This is a backend data collection system. It doesn't have a user interface -
        it just captures events from webhooks and stores them in the database.
      </p>

      <div style={{
        background: '#f5f5f5',
        padding: '20px',
        borderRadius: '6px',
        marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px', fontWeight: '500' }}>
          Active Webhooks
        </h2>
        <ul style={{ listStyle: 'disc', marginLeft: '20px', lineHeight: '1.8' }}>
          <li><code>/api/stripe-webhook</code> - Payment events (matches by email)</li>
          <li><code>/api/denefits-webhook</code> - BNPL financing events (matches by email)</li>
          <li><code>/api/ghl-webhook</code> - Booking & attendance events (smart matching)</li>
          <li><code>/api/manychat</code> - Bot conversation events (matches by MC_ID)</li>
        </ul>
      </div>

      <div style={{
        background: '#e8f5e9',
        padding: '20px',
        borderRadius: '6px',
        marginBottom: '24px',
        border: '1px solid #81c784'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px', fontWeight: '500', color: '#2e7d32' }}>
          Duplicate Prevention Strategy
        </h2>
        <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#1b5e20' }}>
          <p style={{ marginBottom: '12px' }}>
            <strong>ManyChat:</strong> Uses MC_ID (unique) - prevents duplicates within ManyChat
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>GHL:</strong> Smart matching - tries GHL_ID → Email → Phone (links to existing ManyChat contacts)
          </p>
          <p style={{ marginBottom: '12px' }}>
            <strong>Stripe/Denefits:</strong> Email matching across all 3 email fields (creates orphan payments if no match)
          </p>
          <p style={{ marginTop: '16px', fontStyle: 'italic' }}>
            Each contact can have one MC_ID and one GHL_ID, preventing duplicates across platforms.
          </p>
        </div>
      </div>

      <p style={{ color: '#999', fontSize: '14px' }}>
        System running on Vercel. Data stored in Supabase. Last deployed: Nov 5, 2025.
      </p>
    </div>
  );
}
