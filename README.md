# MCB ManyChat Automation System

An AI-powered conversation routing and automation system built with Next.js, TypeScript, Supabase, and OpenAI.

## Features

- 🤖 AI-powered conversation routing using OpenAI GPT-4
- 📊 Real-time dashboard for monitoring webhook activity
- 🔗 ManyChat webhook integration
- 💾 Supabase database for data persistence
- 🚀 Optimized for Vercel deployment

## Quick Start

### Prerequisites

- Node.js 18+ 
- A Supabase account and project
- An OpenAI API key
- A ManyChat account with webhook access

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up your environment variables:

```bash
cp .env.local.example .env.local
```

3. Configure your environment variables in `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# ManyChat Configuration
MANYCHAT_VERIFY_TOKEN=your_manychat_verify_token
```

4. Set up your Supabase database:
   - Run the SQL commands from `sql/setup.sql` in your Supabase SQL editor
   - Refer to `docs/SUPABASE_SETUP_GUIDE.md` for detailed instructions

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── ai-router/          # AI conversation routing endpoint
│   │   └── webhooks/           # ManyChat webhook receiver
│   ├── dashboard/              # Admin dashboard
│   └── page.tsx               # Landing page
├── lib/
│   └── supabase.ts            # Supabase client configuration
├── utils/
│   └── openai.ts              # OpenAI utilities and helpers
├── docs/                      # Project documentation
├── sql/                       # Database setup scripts
└── .env.local.example         # Environment variables template
```

## API Endpoints

### POST /api/ai-router
AI-powered conversation routing and response generation.

**Request:**
```json
{
  "message": "User message text",
  "context": {
    "user_id": "123",
    "previous_messages": []
  }
}
```

**Response:**
```json
{
  "response": "AI-generated response",
  "metadata": {
    "model": "gpt-4o-mini",
    "tokens": 150
  }
}
```

### POST /api/webhooks
ManyChat webhook receiver for processing incoming messages and events.

**Features:**
- Webhook signature verification
- Event logging to Supabase
- Support for multiple event types

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Configure environment variables in the Vercel dashboard
3. Deploy automatically on every push to main

### Manual Deployment

```bash
npm run build
npm start
```

## Database Schema

The application uses the following main tables:
- `webhook_logs`: Stores incoming webhook data
- `conversation_logs`: Tracks AI conversations and responses

See `sql/setup.sql` for the complete schema.

## Configuration

### ManyChat Webhook Setup

1. In your ManyChat account, go to Settings > Webhook
2. Set the webhook URL to: `https://your-domain.com/api/webhooks`
3. Configure your verify token in the environment variables

### OpenAI Configuration

The system uses GPT-4o-mini for optimal performance and cost efficiency. You can modify the model in `utils/openai.ts`.

## Development

### Running Tests

```bash
npm run test
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Documentation

- [Product Requirements Document](docs/MCB_PRD.md)
- [Supabase Setup Guide](docs/SUPABASE_SETUP_GUIDE.md)

## Support

For questions and support, please refer to the documentation in the `docs/` directory.
