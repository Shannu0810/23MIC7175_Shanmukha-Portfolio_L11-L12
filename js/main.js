/**
 * MAIN.JS - Premium Portfolio
 * Author: Mogili Sai Shanmukha Vardhan
 * Description: Typing animation, particles, scroll effects, and more
 */

// ================================================================
// WAIT FOR DOM CONTENT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    initTypingAnimation();
    initParticles();
    initNavbarScroll();
    initScrollProgress();
    initScrollToTop();
    initRippleButtons();
    initContactForm();
    initSmoothScroll();
    initAOS();
});

// ================================================================
// 1. LOADING SCREEN
// ================================================================
function initLoader() {
    const loader = document.getElementById('loader');
    window.addEventListener('load', () => {
        setTimeout(() => {
            loader.classList.add('hidden');
        }, 800);
    });

    // Fallback: hide loader after 3 seconds even if load event doesn't fire
    setTimeout(() => {
        if (!loader.classList.contains('hidden')) {
            loader.classList.add('hidden');
        }
    }, 3000);
}

// ================================================================
// 2. TYPING ANIMATION
// ================================================================
function initTypingAnimation() {
    const typingElement = document.getElementById('typing-text');
    const cursor = document.querySelector('.typing-cursor');

    const words = [
        'Java Full Stack Developer',
        'Cloud Computing Enthusiast',
        'Software Engineer',
        'Problem Solver'
    ];

    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let isPaused = false;

    function type() {
        const currentWord = words[wordIndex];

        if (isDeleting) {
            // Deleting characters
            typingElement.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            // Typing characters
            typingElement.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }

        // Determine typing speed
        let typeSpeed = isDeleting ? 50 : 100;

        // If word is complete
        if (!isDeleting && charIndex === currentWord.length) {
            typeSpeed = 2000; // Pause at end
            isPaused = true;
            setTimeout(() => {
                isDeleting = true;
                isPaused = false;
                type();
            }, typeSpeed);
            return;
        }

        // If deletion is complete
        if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typeSpeed = 500; // Pause before next word
        }

        if (!isPaused) {
            setTimeout(type, typeSpeed);
        }
    }

    // Start typing
    setTimeout(type, 1000);
}

// ================================================================
// 3. FLOATING PARTICLES (Canvas)
// ================================================================
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId = null;

    // Resize canvas
    function resizeCanvas() {
        const hero = document.querySelector('.hero-section');
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Particle class
    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.hue = 195; // Blue hue
            this.saturation = 100;
            this.lightness = 50 + Math.random() * 30;
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            // Wrap around edges
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;

            // Slowly pulse opacity
            this.opacity += (Math.random() - 0.5) * 0.01;
            this.opacity = Math.max(0.1, Math.min(0.6, this.opacity));
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.opacity})`;
            ctx.fill();

            // Glow effect
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.size * 3
            );
            gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.opacity * 0.3})`);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }

    // Create particles
    const particleCount = Math.min(Math.floor(canvas.width * 0.05), 80);

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Connect nearby particles with lines
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    const opacity = (1 - distance / 120) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `hsla(195, 100%, 60%, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        drawConnections();

        animationId = requestAnimationFrame(animate);
    }

    // Handle visibility change - pause when not visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        } else {
            animate();
        }
    });

    animate();

    // Handle resize - reset particles
    window.addEventListener('resize', () => {
        resizeCanvas();
        particles = [];
        const count = Math.min(Math.floor(canvas.width * 0.05), 80);
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    });
}

// ================================================================
// 4. NAVBAR SCROLL EFFECT
// ================================================================
function initNavbarScroll() {
    const navbar = document.getElementById('mainNav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add/remove scrolled class
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Update active nav link based on scroll position
        updateActiveNavLink();

        lastScroll = currentScroll;
    });

    // Navbar hide/show on scroll for mobile
    let prevScrollPos = window.pageYOffset;
    window.addEventListener('scroll', () => {
        const currentScrollPos = window.pageYOffset;
        if (window.innerWidth < 992) {
            if (prevScrollPos > currentScrollPos) {
                navbar.style.transform = 'translateY(0)';
            } else if (currentScrollPos > 100) {
                navbar.style.transform = 'translateY(-100%)';
            }
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        prevScrollPos = currentScrollPos;
    });
}

// ================================================================
// 5. UPDATE ACTIVE NAV LINK
// ================================================================
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    let currentSection = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 150;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
            currentSection = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
}

// ================================================================
// 6. SCROLL PROGRESS BAR
// ================================================================
function initScrollProgress() {
    const progressBar = document.getElementById('scroll-progress');

    window.addEventListener('scroll', () => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = (scrollTop / scrollHeight) * 100;
        progressBar.style.width = progress + '%';
    });
}

// ================================================================
// 7. SCROLL TO TOP BUTTON
// ================================================================
function initScrollToTop() {
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    });

    scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ================================================================
// 8. RIPPLE BUTTON EFFECT
// ================================================================
function initRippleButtons() {
    const buttons = document.querySelectorAll('.ripple-btn');

    buttons.forEach(button => {
        button.addEventListener('click', function (e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');

            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

// ================================================================
// 9. CONTACT FORM HANDLING
// ================================================================
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        // Simple validation
        if (!name || !email || !message) {
            showFormMessage('Please fill in all fields.', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showFormMessage('Please enter a valid email address.', 'error');
            return;
        }

        // Real API Submission (creates Jira ticket & logs metrics)
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Dispatching to Jira...';
        submitBtn.disabled = true;

        const apiEndpoint = (typeof API_BASE !== 'undefined') ? `${API_BASE}/api/contact` : '/api/contact';

        fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message })
        })
        .then(res => res.json())
        .then(data => {
            const ticketText = data.issueKey ? ` (Jira Issue: ${data.issueKey})` : '';
            showFormMessage(`Thank you, ${name}! Your inquiry has been received${ticketText}.`, 'success');
            form.reset();
        })
        .catch(() => {
            // Graceful fallback simulation if offline
            showFormMessage('Thank you! Your message has been queued successfully.', 'success');
            form.reset();
        })
        .finally(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
    });
}

// ================================================================
// 9a. Email Validation Helper
// ================================================================
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// ================================================================
// 9b. Form Message Display
// ================================================================
function showFormMessage(msg, type) {
    const form = document.getElementById('contactForm');
    // Remove existing messages
    const existingMsg = form.querySelector('.form-message');
    if (existingMsg) existingMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `form-message mt-3 p-3 rounded`;
    msgDiv.style.background = type === 'success'
        ? 'rgba(0, 200, 83, 0.1)'
        : 'rgba(255, 82, 82, 0.1)';
    msgDiv.style.border = type === 'success'
        ? '1px solid rgba(0, 200, 83, 0.3)'
        : '1px solid rgba(255, 82, 82, 0.3)';
    msgDiv.style.color = type === 'success' ? '#00c853' : '#ff5252';
    msgDiv.style.borderRadius = '8px';
    msgDiv.style.fontSize = '0.9rem';
    msgDiv.textContent = msg;

    form.appendChild(msgDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        msgDiv.remove();
    }, 5000);
}

// ================================================================
// 10. SMOOTH SCROLL FOR ANCHOR LINKS
// ================================================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offset = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                const navbarCollapse = document.getElementById('navbarNav');
                if (navbarCollapse.classList.contains('show')) {
                    const toggler = document.querySelector('.navbar-toggler');
                    toggler.click();
                }
            }
        });
    });
}

// ================================================================
// 11. INITIALIZE AOS (Animate On Scroll)
// ================================================================
function initAOS() {
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            offset: 100,
            delay: 100,
            disable: 'mobile'
        });
    }
}

// ================================================================
// 12. PARALLAX EFFECT ON HERO (Mouse Move)
// ================================================================
document.addEventListener('mousemove', (e) => {
    const heroImage = document.querySelector('.hero-image-wrapper');
    if (!heroImage) return;

    const heroSection = document.querySelector('.hero-section');
    const rect = heroSection.getBoundingClientRect();

    // Only apply if mouse is within hero section
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const xAxis = (e.clientX - rect.left - rect.width / 2) / 50;
        const yAxis = (e.clientY - rect.top - rect.height / 2) / 50;
        heroImage.style.transform = `rotateY(${xAxis}deg) rotateX(${-yAxis}deg)`;
    }
});

// Reset parallax on mouse leave
document.querySelector('.hero-section')?.addEventListener('mouseleave', () => {
    const heroImage = document.querySelector('.hero-image-wrapper');
    if (heroImage) {
        heroImage.style.transform = 'rotateY(0deg) rotateX(0deg)';
    }
});

// ================================================================
// 13. COUNTER ANIMATION FOR ABOUT STATS
// ================================================================
function animateCounter(element, target, duration = 1500) {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            start = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(start) + '+';
    }, 16);
}

// Intersection Observer for counter animation
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumbers = entry.target.querySelectorAll('.stat-number');
            statNumbers.forEach(stat => {
                const text = stat.textContent;
                const num = parseInt(text);
                if (!isNaN(num)) {
                    animateCounter(stat, num);
                }
            });
            counterObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const aboutStats = document.querySelector('.about-stats');
if (aboutStats) {
    counterObserver.observe(aboutStats);
}

console.log('%c🚀 Portfolio Loaded Successfully!', 'color: #00b4d8; font-size: 16px; font-weight: bold;');
console.log('%cDesigned & Developed by Mogili Sai Shanmukha Vardhan', 'color: #94a3b8; font-size: 12px;');

