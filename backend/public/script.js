// ===== HEALTHPLUS CLINIC - MODERN JAVASCRIPT =====
// Enhanced functionality with modern ES6+ features

document.addEventListener('DOMContentLoaded', function () {
    // ===== NAVBAR SCROLL EFFECT =====
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
    });

    // ===== MOBILE MENU TOGGLE =====
    const mobileToggle = document.querySelector('.mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');

    mobileToggle?.addEventListener('click', () => {
        navMenu?.classList.toggle('active');
        mobileToggle.classList.toggle('active');
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu?.classList.remove('active');
            mobileToggle?.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.navbar')) {
            navMenu?.classList.remove('active');
            mobileToggle?.classList.remove('active');
        }
    });

    // ===== SET MINIMUM DATE FOR APPOINTMENTS =====
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];

    dateInputs.forEach(input => {
        if (input.id.includes('appointment') || input.id.includes('Appointment')) {
            input.setAttribute('min', today);
        }
    });

    // ===== COUNTER ANIMATION =====
    const animateCounters = () => {
        const counters = document.querySelectorAll('[data-count]');

        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-count'));
            const duration = 2000;
            const step = target / (duration / 16);
            let current = 0;

            const updateCounter = () => {
                current += step;
                if (current < target) {
                    counter.textContent = Math.floor(current).toLocaleString();
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target.toLocaleString() + (counter.getAttribute('data-suffix') || '');
                }
            };

            updateCounter();
        });
    };

    // Trigger counter animation when stats are in view
    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        observer.observe(statsSection);
    }

    // ===== SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // ===== TAB SYSTEM =====
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');

            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            document.getElementById(target)?.classList.add('active');
        });
    });

    // ===== FORM HANDLERS =====

    // Quick Booking Form
    const quickBookingForm = document.getElementById('quickBookingForm');
    quickBookingForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        showAlert('Appointment request submitted! We will contact you shortly to confirm.', 'success');
        this.reset();
    });

    // Detailed Booking Form
    const detailedBookingForm = document.getElementById('detailedBookingForm');
    detailedBookingForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = document.getElementById('patientEmail')?.value;
        showAlert(`Appointment booked successfully! Confirmation sent to ${email}`, 'success');
        this.reset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Patient Login Form
    const patientLoginForm = document.getElementById('patientLoginForm');
    patientLoginForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        showAlert('Login successful! Redirecting to dashboard...', 'success');
        setTimeout(() => {
            window.location.href = 'patient-dashboard.html';
        }, 1500);
    });

    // Doctor Login Form
    const doctorLoginForm = document.getElementById('doctorLoginForm');
    doctorLoginForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        showAlert('Login successful! Redirecting to dashboard...', 'success');
        setTimeout(() => {
            window.location.href = 'doctor-dashboard.html';
        }, 1500);
    });

    // Patient Register Form
    const patientRegisterForm = document.getElementById('patientRegisterForm');
    patientRegisterForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        const password = document.getElementById('regPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        if (password !== confirmPassword) {
            showAlert('Passwords do not match!', 'error');
            return;
        }

        showAlert('Registration successful! Please login with your credentials.', 'success');

        // Switch to login tab
        setTimeout(() => {
            document.querySelector('[data-tab="login"]')?.click();
        }, 1500);
    });

    // Contact Form
    const contactForm = document.getElementById('contactForm');
    contactForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        showAlert('Message sent successfully! We will get back to you within 24 hours.', 'success');
        this.reset();
    });

    // Prescription Form
    const prescriptionForm = document.getElementById('prescriptionForm');
    prescriptionForm?.addEventListener('submit', function (e) {
        e.preventDefault();
        showAlert('Prescription saved and sent to patient!', 'success');
    });
});

// ===== SHOW ALERT FUNCTION =====
function showAlert(message, type = 'info') {
    // Remove existing alerts
    document.querySelectorAll('.alert').forEach(a => a.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;

    document.body.appendChild(alert);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// ===== UTILITY FUNCTIONS =====

function cancelAppointment(id) {
    if (confirm('Are you sure you want to cancel this appointment?')) {
        showAlert('Appointment cancelled successfully.', 'success');
    }
}

function rescheduleAppointment(id) {
    showAlert('Redirecting to reschedule page...', 'info');
}

function downloadPrescription(id) {
    showAlert('Downloading prescription...', 'info');
}

function downloadLabReport(id) {
    showAlert('Downloading lab report...', 'info');
}

function requestRefill(id) {
    showAlert('Refill request submitted!', 'success');
}

function makePayment(id) {
    showAlert('Redirecting to payment gateway...', 'info');
}

function startVideoCall(id) {
    showAlert('Connecting to video consultation...', 'info');
}

function viewPatientRecord(id) {
    showAlert('Loading patient records...', 'info');
}

function startConsultation(id) {
    showAlert('Starting consultation...', 'success');
}

function writePrescription(id) {
    showAlert('Opening prescription form...', 'info');
    document.getElementById('prescriptionForm')?.scrollIntoView({ behavior: 'smooth' });
}

function callPatient(id) {
    showAlert('Calling patient...', 'info');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'index.html';
    }
}

function filterDoctors(specialty, event) {
    const cards = document.querySelectorAll('.doctor-card');
    const buttons = document.querySelectorAll('.filter-btn');

    // Update button styles
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // Filter cards
    cards.forEach(card => {
        if (specialty === 'all' || card.dataset.specialty === specialty) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ===== CONSOLE BRANDING =====
console.log('%c🏥 HealthPlus Clinic', 'color: #64ffda; font-size: 24px; font-weight: bold;');
console.log('%cYour Family\'s Health Partner Since 2018', 'color: #8892b0; font-size: 14px;');
// ===== SERVICE WORKER REGISTRATION (PWA) =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => console.log("Service Worker registered"))
      .catch(err => console.error("Service Worker failed:", err));
  });
}
