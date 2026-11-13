const client = require('prom-client');

// Initialize default Node.js and OS metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'portfolio_' });

// HTTP Request Counter
const httpRequestsTotal = new client.Counter({
  name: 'portfolio_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code']
});

// HTTP Request Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'portfolio_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

// Authentication Attempts Counter
const authAttemptsTotal = new client.Counter({
  name: 'portfolio_auth_attempts_total',
  help: 'Total login attempts through Google OAuth or Demo',
  labelNames: ['provider', 'status']
});

// MFA Verification Counter
const mfaVerificationsTotal = new client.Counter({
  name: 'portfolio_mfa_verifications_total',
  help: 'Total 2-Step / MFA verification attempts',
  labelNames: ['status']
});

// Resume Access Counter
const resumeViewsTotal = new client.Counter({
  name: 'portfolio_resume_views_total',
  help: 'Total verified access views of the Web Resume'
});

// Contact Form / Jira Inquiries Counter
const contactSubmissionsTotal = new client.Counter({
  name: 'portfolio_contact_submissions_total',
  help: 'Total contact form submissions forwarded to Jira',
  labelNames: ['jira_status']
});

// Middleware for measuring request durations
function metricsMiddleware(req, res, next) {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.route.path : req.path;
    const statusCode = res.statusCode.toString();

    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route, status_code: statusCode }, durationInSeconds);
  });
  next();
}

module.exports = {
  client,
  metricsMiddleware,
  authAttemptsTotal,
  mfaVerificationsTotal,
  resumeViewsTotal,
  contactSubmissionsTotal
};
