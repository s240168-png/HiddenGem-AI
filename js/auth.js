// Authentication & Portal controller for HiddenGemsAI

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const requestedRole = urlParams.get('role');
  const redirectTarget = urlParams.get('redirect');
  const verifyTokenParam = urlParams.get('verifyToken');
  const emailParam = urlParams.get('email');

  // Elements
  const verifyBanner = document.getElementById('email-verify-banner');
  const verifyBadgeTitle = document.getElementById('verify-badge-title');
  const verifyHeading = document.getElementById('verify-heading');
  const verifyStatusText = document.getElementById('verify-status-text');
  const resendEmailWrap = document.getElementById('resend-email-wrap');
  const resendForm = document.getElementById('resend-verification-form');
  const resendEmailInput = document.getElementById('resend-email-input');
  const btnResendEmail = document.getElementById('btn-resend-email');
  const btnCloseVerify = document.getElementById('btn-close-verify');

  function setupTabs(cardSelector) {
    const card = document.querySelector(cardSelector);
    if (!card) return;
    const tabButtons = card.querySelectorAll('.portal-tabs button');
    const loginForm = card.querySelector('.login-form');
    const registerForm = card.querySelector('.register-form');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.tab;
        if (mode === 'login') {
          loginForm.style.display = 'flex';
          registerForm.style.display = 'none';
        } else {
          loginForm.style.display = 'none';
          registerForm.style.display = 'flex';
        }
        clearMessages(card);
      });
    });
  }

  setupTabs('.portal-card.traveler');
  setupTabs('.portal-card.merchant');

  if (requestedRole === 'traveler' || requestedRole === 'merchant') {
    const targetCard = document.querySelector(`.portal-card.${requestedRole}`);
    const otherCard = document.querySelector(`.portal-card.${requestedRole === 'traveler' ? 'merchant' : 'traveler'}`);
    if (targetCard) {
      targetCard.classList.add('portal-card-highlighted');
      if (otherCard) otherCard.classList.add('portal-card-dimmed');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function showMessage(card, type, text) {
    const msgEl = card.querySelector('.auth-message');
    if (!msgEl) return;
    msgEl.className = `auth-message ${type}`;
    msgEl.textContent = text;
    msgEl.style.display = 'block';
  }

  function clearMessages(card) {
    const msgEl = card.querySelector('.auth-message');
    if (msgEl) msgEl.style.display = 'none';
  }

  function showVerifyBanner(title, heading, message, showResend = false, prefillEmail = '') {
    if (verifyBadgeTitle) verifyBadgeTitle.textContent = title;
    if (verifyHeading) verifyHeading.textContent = heading;
    if (verifyStatusText) verifyStatusText.textContent = message;
    if (resendEmailWrap) resendEmailWrap.style.display = showResend ? 'block' : 'none';
    if (prefillEmail && resendEmailInput) resendEmailInput.value = prefillEmail;
    if (verifyBanner) verifyBanner.style.display = 'block';
    verifyBanner?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideVerifyBanner() {
    if (verifyBanner) verifyBanner.style.display = 'none';
  }

  if (btnCloseVerify) {
    btnCloseVerify.addEventListener('click', hideVerifyBanner);
  }

  // Handle auto-verification if token in URL
  const tokenFromUrl = verifyTokenParam || urlParams.get('token');
  if (tokenFromUrl) {
    showVerifyBanner('ACCOUNT VERIFICATION', 'Email Verification', 'Verifying your email address, please wait...');
    (async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenFromUrl, email: emailParam || '' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showVerifyBanner('✓ EMAIL VERIFIED', 'Verification Successful', 'Your email has been verified! You can now log in below.', false);
          if (data.data?.user?.role) {
            const role = data.data.user.role;
            const card = document.querySelector(`.portal-card.${role}`);
            if (card) {
              const loginTabBtn = card.querySelector('.portal-tabs button[data-tab="login"]');
              if (loginTabBtn) loginTabBtn.click();
              const emailInput = card.querySelector('.login-form input[type="email"]');
              if (emailInput && data.data.user.email) emailInput.value = data.data.user.email;
              showMessage(card, 'success', 'Email verified! Please enter your password to log in.');
            }
          }
        } else if (data.alreadyVerified) {
          showVerifyBanner('ACCOUNT VERIFIED', 'Already Verified', data.message || 'This account is already verified. Please log in below.', false);
        } else if (data.expired) {
          showVerifyBanner('LINK EXPIRED', 'Verification Link Expired', 'Your verification link has expired. Request a new link below:', true, emailParam || '');
        } else {
          showVerifyBanner('VERIFICATION FAILED', 'Verification Failed', data.message || 'Invalid or expired verification link.', true, emailParam || '');
        }
      } catch (err) {
        console.error('Verify error:', err);
        showVerifyBanner('ERROR', 'Verification Error', 'Unable to connect to server. Please check your internet connection.', true, emailParam || '');
      }
    })();
  }

  // Resend verification form handler
  if (resendForm) {
    resendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = resendEmailInput ? resendEmailInput.value.trim() : '';
      if (!email) return;

      if (btnResendEmail) {
        btnResendEmail.disabled = true;
        btnResendEmail.textContent = 'Sending...';
      }

      try {
        const res = await fetch('/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showVerifyBanner('EMAIL SENT', 'Verification Sent', data.data?.message || 'A new verification link has been sent to your email.', false);
        } else if (res.status === 429) {
          showVerifyBanner('RATE LIMITED', 'Please Wait', data.message || 'Please wait before requesting another email.', true, email);
        } else {
          showVerifyBanner('NOTICE', 'Resend Notice', data.message || 'Failed to resend verification email.', true, email);
        }
      } catch (err) {
        showVerifyBanner('ERROR', 'Network Error', 'Unable to connect to server.', true, email);
      } finally {
        if (btnResendEmail) {
          btnResendEmail.disabled = false;
          btnResendEmail.textContent = '✦ Resend verification link';
        }
      }
    });
  }

  // Traveler Login Form
  const travelerLoginForm = document.getElementById('traveler-login-form');
  if (travelerLoginForm) {
    travelerLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const card = travelerLoginForm.closest('.portal-card');
      clearMessages(card);
      const submitBtn = travelerLoginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

      const email = travelerLoginForm.email.value.trim();
      const password = travelerLoginForm.password.value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role: 'traveler' })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('hgai_user', JSON.stringify(data.data.user));
          showMessage(card, 'success', 'Logged in successfully! Redirecting...');
          const nextUrl = redirectTarget && redirectTarget.includes('traveler') ? redirectTarget : 'traveler-details.html';
          setTimeout(() => { window.location.href = nextUrl; }, 600);
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Log in as Traveler →';
          if (data.unverified) {
            showMessage(card, 'error', data.message);
            showVerifyBanner('UNVERIFIED ACCOUNT', 'Email Verification Required', 'Your email address is not verified yet. Request a verification link below:', true, email);
          } else {
            showMessage(card, 'error', data.message || 'Invalid email or password.');
          }
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log in as Traveler →';
        showMessage(card, 'error', 'Unable to connect to server. Please try again.');
      }
    });
  }

  // Traveler Register Form
  const travelerRegisterForm = document.getElementById('traveler-register-form');
  if (travelerRegisterForm) {
    travelerRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const card = travelerRegisterForm.closest('.portal-card');
      clearMessages(card);
      const submitBtn = travelerRegisterForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      const name = travelerRegisterForm.name.value.trim();
      const email = travelerRegisterForm.email.value.trim();
      const password = travelerRegisterForm.password.value;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role: 'traveler' })
        });
        const data = await res.json();

        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Traveler Account →';

        if (res.ok && data.success) {
          showMessage(card, 'success', data.data?.message || 'Account created! Please check your email to verify your account.');
          showVerifyBanner('ACCOUNT CREATED', 'Check Your Email', 'A verification link has been sent to your email address. Please verify your email before logging in.', true, email);
          const loginTabBtn = card.querySelector('.portal-tabs button[data-tab="login"]');
          if (loginTabBtn) loginTabBtn.click();
          const loginEmailInput = card.querySelector('.login-form input[type="email"]');
          if (loginEmailInput) loginEmailInput.value = email;
        } else {
          showMessage(card, 'error', data.message || 'Registration failed.');
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Traveler Account →';
        showMessage(card, 'error', 'Unable to connect to server. Please try again.');
      }
    });
  }

  // Merchant Login Form
  const merchantLoginForm = document.getElementById('merchant-login-form');
  if (merchantLoginForm) {
    merchantLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const card = merchantLoginForm.closest('.portal-card');
      clearMessages(card);
      const submitBtn = merchantLoginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Logging in...';

      const email = merchantLoginForm.email.value.trim();
      const password = merchantLoginForm.password.value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role: 'merchant' })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('hgai_user', JSON.stringify(data.data.user));
          showMessage(card, 'success', 'Logged in successfully! Redirecting...');
          const nextUrl = redirectTarget && redirectTarget.includes('merchant') ? redirectTarget : 'merchant-details.html';
          setTimeout(() => { window.location.href = nextUrl; }, 600);
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Log in as Merchant →';
          if (data.unverified) {
            showMessage(card, 'error', data.message);
            showVerifyBanner('UNVERIFIED ACCOUNT', 'Email Verification Required', 'Your email address is not verified yet. Request a verification link below:', true, email);
          } else {
            showMessage(card, 'error', data.message || 'Invalid email or password.');
          }
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log in as Merchant →';
        showMessage(card, 'error', 'Unable to connect to server. Please try again.');
      }
    });
  }

  // Merchant Register Form
  const merchantRegisterForm = document.getElementById('merchant-register-form');
  if (merchantRegisterForm) {
    merchantRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const card = merchantRegisterForm.closest('.portal-card');
      clearMessages(card);
      const submitBtn = merchantRegisterForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering business...';

      const businessName = merchantRegisterForm.businessName.value.trim();
      const email = merchantRegisterForm.email.value.trim();
      const phone = merchantRegisterForm.phone?.value.trim();
      const address = merchantRegisterForm.address?.value.trim();
      const latitude = merchantRegisterForm.latitude?.value.trim();
      const longitude = merchantRegisterForm.longitude?.value.trim();
      const password = merchantRegisterForm.password.value;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: businessName, businessName, email, password, role: 'merchant', phone, address, latitude, longitude })
        });
        const data = await res.json();

        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Merchant Account →';

        if (res.ok && data.success) {
          showMessage(card, 'success', data.data?.message || 'Merchant account created! Please check your email to verify your account.');
          showVerifyBanner('ACCOUNT CREATED', 'Check Your Email', 'A verification link has been sent to your business email. Please verify before logging in.', true, email);
          const loginTabBtn = card.querySelector('.portal-tabs button[data-tab="login"]');
          if (loginTabBtn) loginTabBtn.click();
          const loginEmailInput = card.querySelector('.login-form input[type="email"]');
          if (loginEmailInput) loginEmailInput.value = email;
        } else {
          showMessage(card, 'error', data.message || 'Registration failed.');
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Merchant Account →';
        showMessage(card, 'error', 'Unable to connect to server. Please try again.');
      }
    });
  }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Merchant Account →';
        showMessage(card, 'error', 'Unable to connect to server. Please try again.');
      }
    });
  }

  // Check if currently authenticated
  async function checkSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.user) {
          const user = data.data.user;
          const statusBanner = document.getElementById('active-session-banner');
          if (statusBanner) {
            statusBanner.style.display = 'block';
            statusBanner.innerHTML = `
              <div class="user-profile-pill" style="display:inline-flex;margin:10px auto;">
                <span>Logged in as <b>${user.name || user.email}</b></span>
                <span class="user-role">${user.role}</span>
                <a href="${user.role === 'merchant' ? 'merchant.html' : 'customer.html'}" style="color:#d9367b;font-weight:800;text-decoration:none;margin-left:8px;">Open Dashboard →</a>
              </div>
            `;
          }
        }
      }
    } catch (err) {
      // not logged in, ignore
    }
  }

  checkSession();
});
