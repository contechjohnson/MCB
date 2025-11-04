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
          <li><code>/api/stripe-webhook</code> - Payment events</li>
          <li><code>/api/ghl-webhook</code> - Booking & attendance events</li>
          <li><code>/api/manychat</code> - Bot conversation events</li>
        </ul>
      </div>

      <p style={{ color: '#999', fontSize: '14px' }}>
        System running on Vercel. Data stored in Supabase.
      </p>
    </div>
  );
}
