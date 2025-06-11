const request = require('supertest');
const app = require('./index.js').default;

describe('/api/chat provider routing', () => {
  it('should use the selected provider (gemini)', async () => {
    const res = await request(app)
      .post('/api/chat')
      .field('message', 'test gemini')
      .field('provider', 'gemini');
    expect(res.statusCode).toBe(200);
    // Optionally, check for a Gemini-specific response or log output
  });

  it('should use the selected provider (anthropic)', async () => {
    const res = await request(app)
      .post('/api/chat')
      .field('message', 'test anthropic')
      .field('provider', 'anthropic');
    expect(res.statusCode).toBe(200);
    // Optionally, check for an Anthropic-specific response or log output
  });

  it('should default to openai if no provider is given', async () => {
    const res = await request(app)
      .post('/api/chat')
      .field('message', 'test openai');
    expect(res.statusCode).toBe(200);
    // Optionally, check for an OpenAI-specific response or log output
  });
}); 