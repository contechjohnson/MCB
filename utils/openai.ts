import OpenAI from 'openai';

function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface AIResponse {
  response: string;
  metadata: {
    model: string;
    tokens: number;
  };
}

export async function generateAIResponse(
  message: string,
  context?: Record<string, unknown>,
  systemPrompt?: string
): Promise<AIResponse> {
  const openai = createOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt || 'You are a helpful AI assistant for ManyChat automation.',
      },
      {
        role: 'user',
        content: context 
          ? `Message: ${message}\nContext: ${JSON.stringify(context)}`
          : message,
      },
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  const response = completion.choices[0]?.message?.content || 'No response generated';
  
  return {
    response,
    metadata: {
      model: 'gpt-4o-mini',
      tokens: completion.usage?.total_tokens || 0,
    },
  };
}

export async function analyzeUserIntent(message: string): Promise<{
  intent: string;
  confidence: number;
  entities: string[];
}> {
  const openai = createOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Analyze the user's message and return JSON with:
        - intent: primary intent (greeting, question, complaint, request, etc.)
        - confidence: confidence score from 0-1
        - entities: array of important entities mentioned
        
        Return only valid JSON.`,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    max_tokens: 200,
    temperature: 0.3,
  });

  try {
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return {
      intent: result.intent || 'unknown',
      confidence: result.confidence || 0,
      entities: result.entities || [],
    };
  } catch (error) {
    console.error('Failed to parse intent analysis:', error);
    return {
      intent: 'unknown',
      confidence: 0,
      entities: [],
    };
  }
}