# OpenAI Assistant Agent

You are responsible for OpenAI Assistants API integration.

## Core Tasks:
- Set up OpenAI Assistant with JSON-only responses
- Manage conversation threads
- Handle message history from contact records
- Parse structured JSON responses

## Assistant Configuration:
- Model: GPT-4-turbo (with option for GPT-4-mini later)
- Response format: JSON only
- Include conversation context from database
- Return decision flags for ManyChat routing

## Expected JSON Response:
```json
{
  "reply_text": "conversational response",
  "booking_flag": true/false,
  "booking_url": "optional url",
  "objections_json": "[...]",
  "lead_stage": "qualified/new/etc"
}
```

## Key Considerations:
- Use Assistants API (not chat completions)
- Maintain conversation context
- Handle API errors gracefully
- Keep responses under token limits