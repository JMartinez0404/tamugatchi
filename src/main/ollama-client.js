const http = require('http');
const https = require('https');

class OllamaClient {
  constructor(config) {
    this.host = config.host || 'http://localhost:11434';
    this.model = config.model || 'llama3.2';
  }

  async isAvailable() {
    try {
      await this._request('GET', '/api/tags');
      return true;
    } catch {
      return false;
    }
  }

  async generateSuggestions(projects) {
    const prompt = this._buildPrompt(projects);

    try {
      const response = await this._request('POST', '/api/generate', {
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 500 }
      });

      const text = response.response || response.message?.content || '';
      return this._parseSuggestions(text, projects);
    } catch (err) {
      console.error('Ollama generation failed:', err.message);
      return [];
    }
  }

  _buildPrompt(projects) {
    const projectSummaries = projects.map(p => {
      const daysSinceCommit = p.lastCommitDate
        ? Math.floor((Date.now() - new Date(p.lastCommitDate)) / (1000 * 60 * 60 * 24))
        : 'unknown';

      const backlog = p.backlogItems?.length
        ? `\n  Backlog: ${p.backlogItems.slice(0, 5).join(', ')}`
        : '\n  No backlog file found';

      return `- ${p.name} (${p.path})
  Last commit: ${daysSinceCommit} days ago
  Open issues: ${p.openIssuesCount}
  Has backlog: ${p.hasBacklog}${backlog}`;
    }).join('\n\n');

    return `You are a helpful dev project assistant. Analyze these projects and suggest 1-3 actionable items.
For each suggestion, output EXACTLY this JSON format on its own line:
{"type": "create-issue"|"notify"|"update-backlog", "project": "project-name", "title": "short title", "description": "what and why"}

Projects:
${projectSummaries}

Respond with ONLY the JSON lines, no other text.`;
  }

  _parseSuggestions(text, projects) {
    const suggestions = [];
    if (!text || typeof text !== 'string') return suggestions;
    const lines = text.split('\n').filter(l => l.trim().startsWith('{'));

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.type && parsed.project && parsed.title) {
          // Validate project name matches a known project
          const matchedProject = projects.find(p =>
            p.name.toLowerCase() === parsed.project.toLowerCase()
          );

          suggestions.push({
            id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: parsed.type,
            projectName: matchedProject?.name || parsed.project,
            title: parsed.title,
            description: parsed.description || '',
            createdAt: new Date().toISOString(),
            status: 'pending',
            payload: { githubRepo: matchedProject?.githubRepo }
          });
        }
      } catch {
        // Skip malformed lines
      }
    }

    return suggestions;
  }

  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.host);
      const transport = url.protocol === 'https:' ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ response: data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = { OllamaClient };
