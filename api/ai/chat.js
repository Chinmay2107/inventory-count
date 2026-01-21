const { z } = require('zod');
const { searchKnowledge } = require('./knowledge');

let aiModulesPromise;

async function loadAiModules() {
  if (!aiModulesPromise) {
    aiModulesPromise = Promise.all([import('ai'), import('@ai-sdk/amazon-bedrock')]).then(
      ([aiModule, bedrockModule]) => ({
        generateText: aiModule.generateText,
        bedrock: bedrockModule.bedrock
      })
    );
  }

  return aiModulesPromise;
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1)
});

const contextSchema = z
  .object({
    screen: z.string().min(1).optional(),
    fileName: z.string().min(1).optional(),
    facility: z.string().min(1).optional(),
    errorText: z.string().min(1).optional()
  })
  .optional();

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  context: contextSchema
});

function buildSystemPrompt(context) {
  const lines = [
    'You are the Inventory Cycle Count Assistant for the inventory-count app.',
    'Explain what went wrong and provide clear, step-by-step fixes.',
    'Use the relevant inventory knowledge context when available.',
    'If the user has not provided enough detail, ask for the missing information before guessing.',
    'Keep answers concise and use numbered steps for actions.'
  ];

  if (context && Object.values(context).some((value) => value)) {
    lines.push('Context provided by the user:');
    if (context.screen) lines.push(`- Screen: ${context.screen}`);
    if (context.fileName) lines.push(`- File name: ${context.fileName}`);
    if (context.facility) lines.push(`- Facility: ${context.facility}`);
    if (context.errorText) lines.push(`- Error text: ${context.errorText}`);
  }

  return lines.join('\n');
}

function buildKnowledgeContext(query) {
  if (!query) return '';
  const matches = searchKnowledge(query, 5);
  if (!matches.length) return '';

  const lines = ['Relevant inventory knowledge:'];
  matches.forEach((match, index) => {
    lines.push(`${index + 1}. ${match.title} — ${match.summary}`);
    if (match.steps && match.steps.length) {
      match.steps.forEach((step) => lines.push(`   - ${step}`));
    }
  });

  return lines.join('\n');
}


function applyCors(req, res) {
  const allowedOrigin = process.env.AI_CORS_ORIGIN;
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', issues: parsed.error.flatten() });
    return;
  }

  const firstUserIndex = parsed.data.messages.findIndex((message) => message.role === 'user');
  if (firstUserIndex < 0) {
    res.status(400).json({ error: 'A conversation must start with a user message.' });
    return;
  }

  const conversation = parsed.data.messages.slice(firstUserIndex);

  try {
    const { generateText, bedrock } = await loadAiModules();
    const modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

    const lastUserMessage = [...conversation]
      .reverse()
      .find((message) => message.role === 'user');
    const knowledgeQuery = [parsed.data.context?.errorText, lastUserMessage?.content]
      .filter(Boolean)
      .join(' ');
    const knowledgeContext = buildKnowledgeContext(knowledgeQuery);
    const systemPrompt = knowledgeContext
      ? `${buildSystemPrompt(parsed.data.context)}

${knowledgeContext}`
      : buildSystemPrompt(parsed.data.context);

    const result = await generateText({
      model: bedrock(modelId),
      system: systemPrompt,
      messages: conversation,
      temperature: 0.2
    });

    res.status(200).json({ text: result.text });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate a response.' });
  }
};
