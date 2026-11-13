const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const rateLimit = require('express-rate-limit');

const logger = require('./logger');
const {
  client: prometheusClient,
  metricsMiddleware,
  authAttemptsTotal,
  mfaVerificationsTotal,
  resumeViewsTotal
} = require('./metrics');
const { createJiraIssue } = require('./services/jiraService');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// In-memory OTP store: email -> { otp, expiresAt, name, picture, googleId }
const otpStore = new Map();
// In-memory user sessions (can swap for Redis)
const userDatabase = new Map();

// ====================================================================
// NODEMAILER — Gmail SMTP transporter
// ====================================================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD   // Gmail App Password (not your account password)
  }
});

// Generate a random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
async function sendOTPEmail(toEmail, otp, userName) {
  const mailOptions = {
    from: `"Shanmukha Portfolio 🔐" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Your Portfolio Login OTP Code',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;">
          <tr><td align="center" style="padding:40px 20px;">
            <table width="500" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d1b2a,#1a2a4a);border-radius:20px;border:1px solid rgba(0,180,216,0.3);">
              <tr><td style="padding:40px;">
                <div style="text-align:center;margin-bottom:30px;">
                  <div style="font-size:48px;">🛡️</div>
                  <h1 style="color:#00b4d8;font-size:24px;margin:10px 0 4px;">Portfolio Access Code</h1>
                  <p style="color:#94a3b8;font-size:14px;margin:0;">Two-Factor Authentication</p>
                </div>
                <p style="color:#cbd5e1;font-size:15px;">Hi <strong style="color:#fff;">${userName}</strong>,</p>
                <p style="color:#94a3b8;font-size:14px;line-height:1.6;">
                  You requested access to <strong style="color:#00b4d8;">Mogili Sai Shanmukha Vardhan's Portfolio</strong>. 
                  Use the code below to complete your login. It expires in <strong style="color:#f59e0b;">10 minutes</strong>.
                </p>
                <div style="text-align:center;margin:30px 0;">
                  <div style="display:inline-block;background:rgba(0,180,216,0.1);border:2px solid #00b4d8;border-radius:16px;padding:20px 40px;">
                    <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#00b4d8;font-family:monospace;">${otp}</span>
                  </div>
                </div>
                <p style="color:#64748b;font-size:12px;text-align:center;margin-top:30px;">
                  🔒 This code is valid for 10 minutes only.<br>
                  If you didn't request this, please ignore this email.
                </p>
                <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:20px 0;">
                <p style="color:#475569;font-size:11px;text-align:center;">
                  Mogili Sai Shanmukha Vardhan · Portfolio Auth System · Google OAuth + Email OTP
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  };
  await transporter.sendMail(mailOptions);
}

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(metricsMiddleware);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Too many OTP attempts. Please try again in 10 minutes.' }
});

// Request logger
app.use((req, res, next) => {
  logger.info(`HTTP ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ====================================================================
// HEALTH & METRICS ENDPOINTS
// ====================================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'portfolio-auth-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', prometheusClient.register.contentType);
    res.end(await prometheusClient.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

app.get('/api/observability/stats', async (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    uptimeSeconds: Math.floor(process.uptime()),
    memoryHeapMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    activeSessions: userDatabase.size,
    service: 'portfolio-auth-service',
    status: 'Healthy',
    cluster: 'Minikube / Docker Compose',
    observability: {
      prometheus: 'Enabled',
      grafanaDashboard: 'Ready',
      elkLogging: 'Active'
    }
  });
});

// ====================================================================
// STEP 1: VERIFY GOOGLE SIGN-IN → SEND EMAIL OTP
// ====================================================================
app.post('/api/auth/google/verify', authLimiter, async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Missing Google ID token.' });
  }

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    logger.info('Google OAuth token verified successfully', { email, name });
    authAttemptsTotal.inc({ provider: 'google', status: 'success' });

    // Generate OTP and store it (10 min expiry)
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    otpStore.set(email, { otp, expiresAt, name, picture, googleId, attempts: 0 });

    // Send OTP to the user's Google email
    await sendOTPEmail(email, otp, name);

    logger.info('Email OTP sent successfully', { email });

    // Issue interim token
    const interimToken = jwt.sign(
      { email, mfaVerified: false },
      JWT_SECRET,
      { expiresIn: '12m' }
    );

    return res.json({
      success: true,
      requiresOtp: true,
      interimToken,
      user: { email, name, picture },
      message: `A 6-digit OTP has been sent to ${email}`
    });

  } catch (error) {
    logger.error('Google OAuth verification failed', { error: error.message });
    authAttemptsTotal.inc({ provider: 'google', status: 'failure' });
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  }
});

// ====================================================================
// STEP 2: VERIFY EMAIL OTP → ISSUE SESSION TOKEN
// ====================================================================
app.post('/api/auth/otp/verify', otpLimiter, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing interim token.' });
  }

  const interimToken = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(interimToken, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  if (decoded.mfaVerified) {
    return res.status(400).json({ error: 'Already verified.' });
  }

  const { email } = decoded;
  const { otp } = req.body;

  if (!otp || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Please enter a valid 6-digit OTP.' });
  }

  const record = otpStore.get(email);

  if (!record) {
    return res.status(400).json({ error: 'OTP expired or not found. Please sign in again.' });
  }

  // Check expiry
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP has expired. Please sign in again.' });
  }

  // Brute-force protection
  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > 5) {
    otpStore.delete(email);
    mfaVerificationsTotal.inc({ status: 'failure' });
    return res.status(429).json({ error: 'Too many wrong attempts. Please sign in again.' });
  }

  if (record.otp !== otp) {
    mfaVerificationsTotal.inc({ status: 'failure' });
    const remaining = 5 - record.attempts;
    return res.status(400).json({
      error: `Incorrect OTP. ${remaining} attempt(s) remaining.`
    });
  }

  // OTP correct — clean up
  otpStore.delete(email);
  mfaVerificationsTotal.inc({ status: 'success' });
  logger.info('Email OTP verified successfully', { email });

  // Store user session
  userDatabase.set(email, {
    email,
    name: record.name,
    picture: record.picture,
    googleId: record.googleId,
    provider: 'google',
    lastLogin: new Date().toISOString()
  });

  // Issue permanent JWT
  const verifiedToken = jwt.sign(
    {
      email,
      name: record.name,
      picture: record.picture,
      mfaVerified: true,
      roles: ['recruiter', 'verified_viewer']
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.json({
    success: true,
    message: 'Two-Factor Authentication Successful!',
    token: verifiedToken,
    user: {
      email,
      name: record.name,
      picture: record.picture,
      mfaVerified: true
    }
  });
});

// ====================================================================
// RESEND OTP
// ====================================================================
app.post('/api/auth/otp/resend', authLimiter, async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing interim token.' });
  }

  const interimToken = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(interimToken, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  const { email } = decoded;
  const existing = otpStore.get(email);

  if (!existing) {
    return res.status(400).json({ error: 'Session not found. Please sign in again.' });
  }

  // Generate fresh OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  otpStore.set(email, { ...existing, otp, expiresAt, attempts: 0 });

  await sendOTPEmail(email, otp, existing.name);
  logger.info('OTP resent', { email });

  return res.json({ success: true, message: `A new OTP has been sent to ${email}` });
});

// ====================================================================
// AUTH MIDDLEWARE
// ====================================================================
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied: Authentication required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.mfaVerified) {
      return res.status(403).json({ error: 'Access denied: Two-Factor Authentication required.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid JWT access attempt', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

// ====================================================================
// PROTECTED WEB RESUME DATA
// ====================================================================
app.get('/api/resume/data', requireAuth, (req, res) => {
  resumeViewsTotal.inc();
  logger.info('Verified Web Resume accessed', { user: req.user.email });

  res.json({
    verified: true,
    viewer: req.user,
    profile: {
      name: 'Mogili Sai Shanmukha Vardhan',
      title: 'Java Full Stack Developer & Cloud Computing Enthusiast',
      email: 'shannumogili@gmail.com',
      github: 'https://github.com/Shannu0810',
      linkedin: 'https://www.linkedin.com/in/sai-shanmukha-vardhan-mogili-11036a291',
      summary: 'Passionate software engineer experienced in building robust distributed systems, mastering modern cloud architectures, Docker, Kubernetes, CI/CD automation, and full-stack enterprise solutions.',
      skills: {
        devopsCloud: ['Docker', 'Kubernetes (Minikube)', 'Terraform (IaC)', 'Ansible', 'Prometheus', 'Grafana', 'ELK Stack', 'CI/CD Pipelines'],
        backend: ['Java', 'Spring Boot', 'Node.js', 'REST APIs', 'Microservices', 'OAuth 2.0 + Email OTP MFA'],
        frontend: ['HTML5', 'CSS3 / Bootstrap 5', 'JavaScript (ES6+)', 'Glassmorphism UI', 'Responsive Design'],
        database: ['MySQL', 'PostgreSQL', 'Redis', 'Elasticsearch']
      },
      education: [
        {
          degree: 'B.Tech in Computer Science & Engineering',
          institution: 'Vellore Institute of Technology (VIT)',
          year: '2023 - 2027',
          status: 'Pursuing'
        }
      ],
      certifications: [
        { name: 'Cloud Computing Architecture', issuer: 'Industry Recognized' },
        { name: 'DevOps & Container Orchestration', issuer: 'Docker & Kubernetes' },
        { name: 'Full Stack Java Engineering', issuer: 'Advanced Foundations' }
      ],
      devopsPortfolioArchitecture: {
        infraAsCode: 'Terraform v1.5+',
        configManagement: 'Ansible v2.15+',
        orchestration: 'Minikube / Kubernetes v1.28+',
        observability: 'Prometheus & Grafana',
        logging: 'Elasticsearch, Logstash, Kibana (ELK)',
        security: 'Google OAuth 2.0 + Email OTP Two-Factor Authentication',
        issueTracking: 'Atlassian Jira REST API v3'
      }
    }
  });
});

// ====================================================================
// CONTACT FORM → JIRA INTEGRATION
// ====================================================================
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields (name, email, message) are required.' });
  }

  logger.info('Contact inquiry received', { name, email });
  const result = await createJiraIssue({ name, email, message });
  return res.json(result);
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Portfolio Auth & Observability Backend running on port ${PORT}`, {
    googleAuth: GOOGLE_CLIENT_ID ? 'Configured' : 'Missing',
    emailUser: process.env.EMAIL_USER ? 'Configured' : 'Missing — set EMAIL_USER in .env',
    metricsUrl: `http://localhost:${PORT}/metrics`,
    healthUrl: `http://localhost:${PORT}/health`
  });
});
