/**
 * AUTH.JS - Google OAuth 2.0 & RFC 6238 TOTP Two-Step Verification
 * Author: Mogili Sai Shanmukha Vardhan
 */

const API_BASE = (window.location.hostname === 'localhost' && window.location.port !== '5000' && window.location.port !== '8080')
    ? 'http://localhost:5000'
    : ''; // Relative URL for Nginx reverse-proxy & Docker/Minikube

const GOOGLE_CLIENT_ID = '914232904778-fqaomuks3uj93o4p7u0sta5kef2r81lv.apps.googleusercontent.com';

let interimToken = null;
let verifiedSession = null;
let currentMfaSecret = null;

document.addEventListener('DOMContentLoaded', () => {
    initAuthModal();
    initGoogleAuth();
    initMfaInputs();
    checkExistingSession();
});

// ================================================================
// 1. MODAL INITIALIZATION & CONTROLS
// ================================================================
function initAuthModal() {
    const modalOverlay = document.getElementById('authModalOverlay');
    const closeBtn = document.getElementById('authCloseBtn');
    const openBtns = document.querySelectorAll('.open-auth-modal-btn');

    openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openAuthModal();
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeAuthModal);
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeAuthModal();
        });
    }

    // Demo recruiter login trigger
    const demoBtn = document.getElementById('demoLoginBtn');
    if (demoBtn) {
        demoBtn.addEventListener('click', handleDemoLogin);
    }

    // MFA form submit
    const mfaForm = document.getElementById('mfaForm');
    if (mfaForm) {
        mfaForm.addEventListener('submit', handleMfaSubmit);
    }

    // Sign out trigger
    const signOutBtn = document.getElementById('authSignOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
    }

    // Resume tab toggles
    const tabBtns = document.querySelectorAll('.resume-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.resume-tab-pane').forEach(p => p.classList.remove('active'));
            const activePane = document.getElementById(targetTab);
            if (activePane) activePane.classList.add('active');
        });
    });
}

function openAuthModal() {
    const modal = document.getElementById('authModalOverlay');
    if (modal) modal.classList.add('active');

    // If already authenticated, show verified view
    if (verifiedSession) {
        showStep(3);
        loadVerifiedResume();
        loadTelemetry();
    } else {
        showStep(1);
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModalOverlay');
    if (modal) modal.classList.remove('active');
}

function showStep(stepNumber) {
    document.querySelectorAll('.auth-step-view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.step-pill').forEach(pill => pill.classList.remove('active'));

    const activeView = document.getElementById(`authStep${stepNumber}`);
    const activePill = document.getElementById(`pillStep${stepNumber}`);

    if (activeView) activeView.classList.add('active');
    if (activePill) activePill.classList.add('active');
}

// ================================================================
// 2. GOOGLE OAUTH 2.0 INITIALIZATION
// ================================================================
function initGoogleAuth() {
    if (typeof google === 'undefined' || !google.accounts) {
        // Wait for script to load
        setTimeout(initGoogleAuth, 300);
        return;
    }

    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        const targetDiv = document.getElementById('google-signin-btn');
        if (targetDiv) {
            google.accounts.id.renderButton(targetDiv, {
                theme: 'filled_black',
                size: 'large',
                shape: 'pill',
                text: 'continue_with',
                logo_alignment: 'left',
                width: 280
            });
        }
    } catch (err) {
        console.warn('Google Identity Services initialization info:', err.message);
    }
}

// ================================================================
// 3. HANDLE GOOGLE LOGIN RESPONSE
// ================================================================
async function handleGoogleCredentialResponse(response) {
    showLoadingState(true);
    try {
        const res = await fetch(`${API_BASE}/api/auth/google/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Google login failed.');

        handlePostLoginMfa(data);
    } catch (err) {
        showAuthAlert(err.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

// ================================================================
// 4. HANDLE DEMO / RECRUITER QUICK LOGIN
// ================================================================
async function handleDemoLogin() {
    showLoadingState(true);
    try {
        const res = await fetch(`${API_BASE}/api/auth/demo-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Demo login failed.');

        handlePostLoginMfa(data);

        // In Demo mode, populate quick copy code
        if (data.mfa && data.mfa.demoAutoCode) {
            const demoNotice = document.getElementById('demoMfaNotice');
            if (demoNotice) {
                demoNotice.style.display = 'block';
                demoNotice.innerHTML = `
                    <div style="background: rgba(0, 180, 216, 0.1); border: 1px dashed #00b4d8; padding: 0.6rem; border-radius: 8px; margin-top: 0.5rem; font-size: 0.85rem;">
                        <strong><i class="fas fa-magic me-1"></i> Demo Recruiter Code:</strong> 
                        <code style="color: #00b4d8; font-weight: bold; font-size: 1rem;">${data.mfa.demoAutoCode}</code>
                        <button type="button" class="btn btn-sm btn-outline-info ms-2 py-0" onclick="autoFillDemoCode('${data.mfa.demoAutoCode}')">Autofill</button>
                    </div>
                `;
            }
        }
    } catch (err) {
        showAuthAlert(err.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

// ================================================================
// 5. POST-LOGIN: PREPARE MFA QR CODE
// ================================================================
function handlePostLoginMfa(authData) {
    interimToken = authData.interimToken;
    currentMfaSecret = authData.mfa.secret;

    // Display QR Code
    const qrImg = document.getElementById('mfaQrCodeImg');
    if (qrImg) qrImg.src = authData.mfa.qrCode;

    // Display Secret Key
    const keyElem = document.getElementById('mfaSecretKeyText');
    if (keyElem) keyElem.textContent = authData.mfa.manualKey;

    // Switch to MFA Step
    showStep(2);
    clearMfaInputs();
}

window.autoFillDemoCode = function(code) {
    const inputs = document.querySelectorAll('.mfa-digit-input');
    code.split('').forEach((char, idx) => {
        if (inputs[idx]) inputs[idx].value = char;
    });
    if (inputs[5]) inputs[5].focus();
};

// ================================================================
// 6. MFA DIGIT INPUTS AUTO-FOCUS
// ================================================================
function initMfaInputs() {
    const inputs = document.querySelectorAll('.mfa-digit-input');
    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (input.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Allow pasting 6 digits
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d{6}$/.test(pasteData)) {
                pasteData.split('').forEach((char, i) => {
                    if (inputs[i]) inputs[i].value = char;
                });
                inputs[5].focus();
            }
        });
    });
}

function clearMfaInputs() {
    document.querySelectorAll('.mfa-digit-input').forEach(input => input.value = '');
    const firstInput = document.querySelector('.mfa-digit-input');
    if (firstInput) firstInput.focus();
}

function getMfaCode() {
    let code = '';
    document.querySelectorAll('.mfa-digit-input').forEach(input => {
        code += input.value.trim();
    });
    return code;
}

// ================================================================
// 7. SUBMIT MFA CODE
// ================================================================
async function handleMfaSubmit(e) {
    e.preventDefault();
    const token = getMfaCode();

    if (token.length !== 6) {
        showAuthAlert('Please enter the full 6-digit code from your authenticator app.', 'error');
        return;
    }

    showLoadingState(true);
    try {
        const res = await fetch(`${API_BASE}/api/auth/mfa/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                interimToken,
                token
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'MFA Verification failed.');

        // Successfully verified
        verifiedSession = data;
        localStorage.setItem('portfolio_jwt', data.token);
        localStorage.setItem('portfolio_user', JSON.stringify(data.user));

        updateNavbarUserState(data.user);
        showStep(3);
        loadVerifiedResume();
        loadTelemetry();
    } catch (err) {
        showAuthAlert(err.message, 'error');
    } finally {
        showLoadingState(false);
    }
}

// ================================================================
// 8. LOAD PROTECTED RESUME & TELEMETRY
// ================================================================
async function loadVerifiedResume() {
    const token = localStorage.getItem('portfolio_jwt');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE}/api/resume/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) handleSignOut();
            return;
        }

        const data = await res.json();
        renderResumeContent(data);
    } catch (err) {
        console.error('Failed to load resume:', err);
    }
}

function renderResumeContent(data) {
    const profile = data.profile;
    const container = document.getElementById('verifiedResumeContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="resume-overview">
            <h4 style="color: #00b4d8; font-weight: 700; margin-bottom: 0.25rem;">${profile.name}</h4>
            <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1rem;">${profile.title}</p>
            <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.6; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 10px; border-left: 3px solid #00b4d8;">
                ${profile.summary}
            </p>
        </div>

        <div class="row g-3 mt-2">
            <div class="col-md-6">
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 1rem; border-radius: 12px; height: 100%;">
                    <h6 style="color: #00b4d8; font-weight: 600;"><i class="fas fa-server me-2"></i>DevOps & Cloud Stack</h6>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;">
                        ${profile.skills.devopsCloud.map(s => `<span class="badge bg-dark border border-secondary text-info">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 1rem; border-radius: 12px; height: 100%;">
                    <h6 style="color: #00b4d8; font-weight: 600;"><i class="fas fa-code me-2"></i>Backend & Security</h6>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;">
                        ${profile.skills.backend.map(s => `<span class="badge bg-dark border border-secondary text-light">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-3 text-center">
            <a href="assets/resume.pdf" download class="btn btn-outline-info btn-sm">
                <i class="fas fa-file-download me-1"></i> Download Official Verified Resume (PDF)
            </a>
        </div>
    `;
}

async function loadTelemetry() {
    try {
        const res = await fetch(`${API_BASE}/api/observability/stats`);
        if (!res.ok) return;
        const stats = await res.json();

        const uptimeElem = document.getElementById('telemetryUptime');
        const memoryElem = document.getElementById('telemetryMemory');
        const sessionsElem = document.getElementById('telemetrySessions');
        const statusElem = document.getElementById('telemetryStatus');

        if (uptimeElem) uptimeElem.textContent = `${stats.uptimeSeconds}s`;
        if (memoryElem) memoryElem.textContent = `${stats.memoryHeapMb} MB`;
        if (sessionsElem) sessionsElem.textContent = `${stats.activeSessions}`;
        if (statusElem) statusElem.textContent = stats.status;
    } catch (err) {
        console.warn('Telemetry fetch error:', err);
    }
}

// ================================================================
// 9. CHECK EXISTING SESSION & SIGN OUT
// ================================================================
function checkExistingSession() {
    const token = localStorage.getItem('portfolio_jwt');
    const userStr = localStorage.getItem('portfolio_user');
    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            verifiedSession = { token, user };
            updateNavbarUserState(user);
        } catch (e) {
            handleSignOut();
        }
    }
}

function updateNavbarUserState(user) {
    const navBtn = document.getElementById('navAuthBtn');
    if (navBtn) {
        navBtn.innerHTML = `
            <img src="${user.picture || 'https://ui-avatars.com/api/?name=User'}" 
                 style="width: 22px; height: 22px; border-radius: 50%;" alt="User">
            <span>Verified (${user.name.split(' ')[0]})</span>
        `;
        navBtn.classList.add('verified');
    }
}

function handleSignOut() {
    localStorage.removeItem('portfolio_jwt');
    localStorage.removeItem('portfolio_user');
    verifiedSession = null;
    interimToken = null;
    // Redirect to login page (portfolio is now fully gated)
    window.location.replace('login.html');
}

// Helpers
function showAuthAlert(msg, type) {
    const alertBox = document.getElementById('authAlertBox');
    if (!alertBox) return;
    alertBox.style.display = 'block';
    alertBox.className = `alert alert-${type === 'error' ? 'danger' : 'success'} py-2 px-3 small`;
    alertBox.textContent = msg;
    setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
}

function showLoadingState(isLoading) {
    const loader = document.getElementById('authSubmittingSpinner');
    if (loader) loader.style.display = isLoading ? 'inline-block' : 'none';
}
