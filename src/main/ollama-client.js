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
      console.log('Ollama raw response (suggestions):', text.slice(0, 500));
      const parsed = this._parseSuggestions(text, projects);
      console.log(`Parsed ${parsed.length} suggestions from response`);
      return parsed;
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

  async generateDailyPlan(project) {
    const prompt = this._buildDailyPlanPrompt(project);

    try {
      const response = await this._request('POST', '/api/generate', {
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 1000 }
      });

      const text = response.response || response.message?.content || '';
      console.log(`Ollama daily plan raw (${project.name}):`, text.slice(0, 500));
      const items = this._parsePlanItems(text, project);
      console.log(`Parsed ${items.length} plan items for ${project.name}`);
      return items;
    } catch (err) {
      console.error(`Ollama daily plan failed for ${project.name}:`, err.message);
      return [];
    }
  }

  _buildDailyPlanPrompt(project) {
    const daysSinceCommit = project.lastCommitDate
      ? Math.floor((Date.now() - new Date(project.lastCommitDate)) / (1000 * 60 * 60 * 24))
      : 'unknown';

    const backlog = project.backlogItems?.length
      ? `Current backlog:\n${project.backlogItems.map(b => `  - ${b}`).join('\n')}`
      : 'No backlog file found.';

    const issues = project.openIssues?.length
      ? `Open GitHub issues:\n${project.openIssues.map(i => `  - #${i.number}: ${i.title}`).join('\n')}`
      : `Open issues count: ${project.openIssuesCount || 0}`;

    const recentCommits = project.recentCommits?.length
      ? `Recent commits:\n${project.recentCommits.map(c => `  - ${c}`).join('\n')}`
      : '';

    return `You are a senior software architect doing a daily review of a project.
Analyze this project and suggest up to 3 actionable improvements. Think about:
- New features that would add value
- Potential bugs or issues to investigate
- Performance optimizations or code quality improvements
- Missing tests, documentation, or security concerns

Project: ${project.name}
Path: ${project.path}
Last commit: ${daysSinceCommit} days ago
${issues}
${backlog}
${recentCommits}

For EACH suggestion, output EXACTLY this JSON on its own line:
{"category": "feature"|"bugfix"|"optimization", "title": "short title", "description": "detailed description of what to do and why", "priority": "high"|"medium"|"low"}

Respond with ONLY the JSON lines, no other text.`;
  }

  _parsePlanItems(text, project) {
    const items = [];
    if (!text || typeof text !== 'string') return items;
    const jsonObjects = this._extractJsonObjects(text);

    for (const jsonStr of jsonObjects) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.category && parsed.title) {
          const categoryLabel = {
            feature: 'Feature',
            bugfix: 'Bug Fix',
            optimization: 'Optimization'
          };

          const priorityEmoji = {
            high: '(!)',
            medium: '(?)',
            low: '(.)'
          };

          items.push({
            id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'create-issue',
            projectName: project.name,
            title: `[${categoryLabel[parsed.category] || parsed.category}] ${parsed.title}`,
            description: `${priorityEmoji[parsed.priority] || ''} Priority: ${parsed.priority || 'medium'}\n\n${parsed.description || ''}`,
            createdAt: new Date().toISOString(),
            status: 'pending',
            payload: {
              githubRepo: project.githubRepo,
              category: parsed.category,
              priority: parsed.priority || 'medium',
              fromDailyPlan: true
            }
          });
        }
      } catch {
        // Skip malformed lines
      }
    }

    return items;
  }

  _parseSuggestions(text, projects) {
    const suggestions = [];
    if (!text || typeof text !== 'string') return suggestions;
    const jsonObjects = this._extractJsonObjects(text);

    for (const jsonStr of jsonObjects) {
      try {
        const parsed = JSON.parse(jsonStr);
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

  _extractJsonObjects(text) {
    const objects = [];
    // Strip markdown code fences
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

    // Find all { ... } blocks by tracking brace depth
    let depth = 0;
    let start = -1;

    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (cleaned[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          const candidate = cleaned.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            objects.push(candidate);
          } catch {
            // Not valid JSON, skip
          }
          start = -1;
        }
      }
    }

    return objects;
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
