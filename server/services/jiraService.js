const axios = require('axios');
const logger = require('../logger');
const { contactSubmissionsTotal } = require('../metrics');

async function createJiraIssue({ name, email, message }) {
  const host = process.env.JIRA_HOST;
  const userEmail = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY || 'PORT';

  const isConfigured = host && host.startsWith('https://') &&
                       userEmail && !userEmail.includes('your-domain') &&
                       apiToken && apiToken !== 'your_jira_api_token_here';

  if (!isConfigured) {
    const mockIssueKey = `${projectKey}-${Math.floor(100 + Math.random() * 900)}`;
    logger.info('Jira integration running in mock mode (credentials not configured)', {
      mockIssueKey,
      contact: { name, email, messageLength: message.length }
    });
    contactSubmissionsTotal.inc({ jira_status: 'mock' });
    return {
      success: true,
      mode: 'mock',
      issueKey: mockIssueKey,
      message: 'Inquiry received. Jira issue created (mock mode).'
    };
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${userEmail}:${apiToken}`).toString('base64');
    const jiraUrl = `${host.replace(/\/$/, '')}/rest/api/3/issue`;

    const payload = {
      fields: {
        project: { key: projectKey },
        summary: `Portfolio Recruiter Inquiry from ${name}`,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: `From: ${name} (${email})\n\nMessage:\n${message}` }
              ]
            }
          ]
        },
        issuetype: { name: 'Task' }
      }
    };

    const response = await axios.post(jiraUrl, payload, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 8000
    });

    const issueKey = response.data.key;
    logger.info('Successfully created Jira issue for contact inquiry', {
      issueKey,
      email
    });
    contactSubmissionsTotal.inc({ jira_status: 'created' });

    return {
      success: true,
      mode: 'live',
      issueKey,
      message: `Inquiry dispatched to Jira ticket ${issueKey}`
    };
  } catch (error) {
    const errDetails = error.response ? error.response.data : error.message;
    logger.error('Failed to create Jira issue', { error: errDetails });
    contactSubmissionsTotal.inc({ jira_status: 'failed' });

    // Gracefully succeed for user while logging internal error
    return {
      success: true,
      mode: 'fallback',
      issueKey: `${projectKey}-QUEUED`,
      message: 'Inquiry received and queued.'
    };
  }
}

module.exports = { createJiraIssue };
