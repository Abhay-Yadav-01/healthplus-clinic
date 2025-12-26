// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db = require('./database');
const { Resend } = require('resend');

// ==================== APP CONFIG ====================
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'healthplus-clinic-secret-key-2024';
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_123456789'; // Will be replaced with actual key

// Initialize Resend for email
const resend = new Resend(RESEND_API_KEY);

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files (IMPORTANT)
app.use(express.static(path.join(__dirname, 'public')));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please login first.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token. Please login again.' });
        }
        req.user = user;
        next();
    });
};

// ==================== HELPER FUNCTIONS ====================
// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send Email OTP via Resend
async function sendEmailOTP(email, otp) {
    try {
        const result = await resend.emails.send({
            from: 'HealthPlus Clinic <onboarding@resend.dev>',
            to: email,
            subject: 'Your HealthPlus Clinic Verification OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0a192f, #112240); border-radius: 10px;">
                    <h2 style="color: #64ffda; text-align: center;">
                        <span style="color: #ff6b6b;">❤</span> HealthPlus Clinic
                    </h2>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="color: #ccd6f6; font-size: 16px;">Your One-Time Password (OTP) for registration is:</p>
                        <div style="background: rgba(100,255,218,0.2); padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #64ffda;">${otp}</span>
                        </div>
                        <p style="color: #8892b0; font-size: 14px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
                    </div>
                    <p style="color: #8892b0; font-size: 12px; text-align: center;">
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
            `
        });
        console.log('Email sent:', result);
        return result.id ? true : false;
    } catch (error) {
        console.error('Email Error:', error);
        return false;
    }
}

// ==================== FRONTEND ROUTES ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== OTP ENDPOINTS ====================
// Send OTP to email
app.post('/api/otp/send-email', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email address is required' });
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        // Delete old OTPs for this email
        await db.execute({
            sql: 'DELETE FROM otp_codes WHERE identifier = ? AND type = ?',
            args: [email, 'email']
        });

        // Save new OTP
        await db.execute({
            sql: 'INSERT INTO otp_codes (identifier, otp_code, type, expires_at) VALUES (?, ?, ?, ?)',
            args: [email, otp, 'email', expiresAt]
        });

        // Send Email
        const sent = await sendEmailOTP(email, otp);

        if (sent) {
            res.json({ success: true, message: 'OTP sent to your email' });
        } else {
            // For demo purposes, still allow registration with stored OTP
            res.json({ success: true, message: 'OTP generated', otp: otp }); // Remove otp from response in production
        }
    } catch (error) {
        console.error('Send Email OTP error:', error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// Verify OTP
app.post('/api/otp/verify', async (req, res) => {
    try {
        const { identifier, otp, type } = req.body;

        if (!identifier || !otp || !type) {
            return res.status(400).json({ error: 'Identifier, OTP, and type are required' });
        }

        const result = await db.execute({
            sql: 'SELECT * FROM otp_codes WHERE identifier = ? AND type = ? AND verified = 0 ORDER BY created_at DESC LIMIT 1',
            args: [identifier, type]
        });

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
        }

        const otpRecord = result.rows[0];

        // Check if expired
        if (new Date(otpRecord.expires_at) < new Date()) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Check if OTP matches
        if (otpRecord.otp_code !== otp) {
            return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
        }

        // Mark as verified
        await db.execute({
            sql: 'UPDATE otp_codes SET verified = 1 WHERE id = ?',
            args: [otpRecord.id]
        });

        res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// ==================== CONTACT ====================
app.post('/api/contact', async (req, res) => {
    try {
        const { name, phone, email, subject, message } = req.body;

        if (!name || !phone || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const result = await db.execute({
            sql: 'INSERT INTO contacts (name, phone, email, subject, message) VALUES (?, ?, ?, ?, ?)',
            args: [name, phone, email, subject, message]
        });

        res.json({
            success: true,
            message: 'Contact form submitted successfully',
            id: Number(result.lastInsertRowid)
        });
    } catch (error) {
        console.error('Contact error:', error);
        res.status(500).json({ error: 'Failed to submit contact form' });
    }
});

// ==================== APPOINTMENTS (PROTECTED) ====================
app.post('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const {
            department, doctor, appointmentDate, appointmentTime,
            consultationType, symptoms
        } = req.body;

        if (!department || !doctor || !appointmentDate ||
            !appointmentTime || !consultationType) {
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        // Get patient info from token
        const patientResult = await db.execute({
            sql: 'SELECT * FROM patients WHERE id = ?',
            args: [req.user.id]
        });

        if (patientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const patient = patientResult.rows[0];

        const result = await db.execute({
            sql: `INSERT INTO appointments (
                patient_name, patient_phone, patient_email,
                patient_age, patient_gender, department, doctor,
                appointment_date, appointment_time,
                consultation_type, symptoms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                `${patient.first_name} ${patient.last_name}`,
                patient.phone,
                patient.email,
                '', patient.gender || '',
                department, doctor, appointmentDate,
                appointmentTime, consultationType,
                symptoms || ''
            ]
        });

        res.json({
            success: true,
            message: 'Appointment booked successfully',
            id: Number(result.lastInsertRowid)
        });
    } catch (error) {
        console.error('Appointment error:', error);
        res.status(500).json({ error: 'Failed to book appointment' });
    }
});

app.get('/api/appointments', async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM appointments ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Get patient's own appointments
app.get('/api/my-appointments', authenticateToken, async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM appointments WHERE patient_email = ? ORDER BY created_at DESC',
            args: [req.user.email]
        });
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// ==================== PATIENT AUTH ====================
app.post('/api/patients/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, dob, gender, address, emailOtp } = req.body;

        if (!firstName || !lastName || !email || !phone || !password) {
            return res.status(400).json({ error: 'Required fields are missing' });
        }

        // Verify email OTP
        if (!emailOtp) {
            return res.status(400).json({ error: 'Email OTP verification is required' });
        }

        const otpResult = await db.execute({
            sql: 'SELECT * FROM otp_codes WHERE identifier = ? AND type = ? AND verified = 1 ORDER BY created_at DESC LIMIT 1',
            args: [email, 'email']
        });

        if (otpResult.rows.length === 0) {
            return res.status(400).json({ error: 'Please verify your email first' });
        }

        // Check if email OTP was verified within the last 30 minutes
        const otpRecord = otpResult.rows[0];
        const otpAge = Date.now() - new Date(otpRecord.created_at).getTime();
        if (otpAge > 30 * 60 * 1000) {
            return res.status(400).json({ error: 'Email verification expired. Please verify again.' });
        }

        // Check for existing email
        const existingEmail = await db.execute({
            sql: 'SELECT id FROM patients WHERE email = ?',
            args: [email]
        });

        if (existingEmail.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const result = await db.execute({
            sql: `INSERT INTO patients (
                first_name, last_name, email, phone,
                password, dob, gender, address, email_verified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            args: [
                firstName, lastName, email, phone,
                hashedPassword, dob || '',
                gender || '', address || ''
            ]
        });

        res.json({
            success: true,
            message: 'Registration successful! You can now login.',
            id: Number(result.lastInsertRowid)
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register. Please try again.' });
    }
});

app.post('/api/patients/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await db.execute({
            sql: 'SELECT * FROM patients WHERE email = ?',
            args: [email]
        });

        const patient = result.rows[0];

        if (!patient || !bcrypt.compareSync(password, patient.password)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: patient.id, email: patient.email, type: 'patient' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: patient.id,
                firstName: patient.first_name,
                lastName: patient.last_name,
                email: patient.email,
                phone: patient.phone
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Check auth status
app.get('/api/patients/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT id, first_name, last_name, email, phone FROM patients WHERE id = ?',
            args: [req.user.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json({ success: true, user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});

// ==================== DOCTOR LOGIN ====================
app.post('/api/doctors/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await db.execute({
            sql: 'SELECT * FROM doctors WHERE email = ?',
            args: [email]
        });

        const doctor = result.rows[0];

        if (!doctor || !bcrypt.compareSync(password, doctor.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: doctor.id, email: doctor.email, name: doctor.name, department: doctor.department, type: 'doctor' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email,
                department: doctor.department,
                phone: doctor.phone
            }
        });
    } catch (error) {
        console.error('Doctor login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ==================== DOCTOR DASHBOARD ENDPOINTS ====================

// Get logged-in doctor's profile
app.get('/api/doctors/me', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'doctor') {
            return res.status(403).json({ error: 'Access denied. Doctor authentication required.' });
        }

        const result = await db.execute({
            sql: 'SELECT id, name, email, department, phone, created_at FROM doctors WHERE id = ?',
            args: [req.user.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        res.json({ success: true, doctor: result.rows[0] });
    } catch (error) {
        console.error('Get doctor profile error:', error);
        res.status(500).json({ error: 'Failed to fetch doctor profile' });
    }
});

// Get doctor's appointments (filtered by doctor name)
app.get('/api/doctors/appointments', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'doctor') {
            return res.status(403).json({ error: 'Access denied. Doctor authentication required.' });
        }

        const doctorName = req.user.name;

        const result = await db.execute({
            sql: `SELECT * FROM appointments 
                  WHERE doctor LIKE ? 
                  ORDER BY appointment_date DESC, appointment_time DESC`,
            args: [`%${doctorName}%`]
        });

        // Get stats
        const allAppointments = result.rows;
        const today = new Date().toISOString().split('T')[0];

        const todayAppointments = allAppointments.filter(apt => apt.appointment_date === today);
        const pendingCount = allAppointments.filter(apt => apt.status === 'pending').length;
        const confirmedCount = allAppointments.filter(apt => apt.status === 'confirmed').length;
        const completedCount = allAppointments.filter(apt => apt.status === 'completed').length;

        res.json({
            success: true,
            appointments: result.rows,
            stats: {
                total: allAppointments.length,
                today: todayAppointments.length,
                pending: pendingCount,
                confirmed: confirmedCount,
                completed: completedCount
            }
        });
    } catch (error) {
        console.error('Get doctor appointments error:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// Get contacts/messages (doctors can view patient inquiries)
app.get('/api/doctors/contacts', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'doctor') {
            return res.status(403).json({ error: 'Access denied. Doctor authentication required.' });
        }

        const result = await db.execute('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 50');
        res.json({ success: true, contacts: result.rows });
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

// Update appointment status
app.put('/api/appointments/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const appointmentId = req.params.id;

        if (!status || !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Valid status required (pending, confirmed, completed, cancelled)' });
        }

        await db.execute({
            sql: 'UPDATE appointments SET status = ? WHERE id = ?',
            args: [status, appointmentId]
        });

        res.json({ success: true, message: 'Appointment status updated' });
    } catch (error) {
        console.error('Update appointment status error:', error);
        res.status(500).json({ error: 'Failed to update appointment status' });
    }
});

// ==================== ADMIN ====================
app.get('/api/admin/contacts', async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM contacts ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

app.delete('/api/admin/contacts/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM contacts WHERE id = ?',
            args: [req.params.id]
        });
        res.json({ success: true, message: 'Contact deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

app.delete('/api/admin/appointments/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM appointments WHERE id = ?',
            args: [req.params.id]
        });
        res.json({ success: true, message: 'Appointment deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete appointment' });
    }
});

app.delete('/api/admin/patients/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM patients WHERE id = ?',
            args: [req.params.id]
        });
        res.json({ success: true, message: 'Patient deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete patient' });
    }
});

app.get('/api/admin/appointments', async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM appointments ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

app.get('/api/admin/patients', async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM patients ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
});

app.get('/api/admin/doctors', async (req, res) => {
    try {
        const result = await db.execute('SELECT id, name, email, department, phone, created_at FROM doctors ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch doctors' });
    }
});

// Add new doctor
app.post('/api/admin/doctors', async (req, res) => {
    try {
        const { name, email, department, phone, password } = req.body;

        if (!name || !email || !department) {
            return res.status(400).json({ error: 'Name, email, and department are required' });
        }

        const existing = await db.execute({
            sql: 'SELECT id FROM doctors WHERE email = ?',
            args: [email]
        });

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = bcrypt.hashSync(password || 'doctor123', 10);

        const result = await db.execute({
            sql: 'INSERT INTO doctors (name, email, password, department, phone) VALUES (?, ?, ?, ?, ?)',
            args: [name, email, hashedPassword, department, phone || '']
        });

        res.json({
            success: true,
            message: 'Doctor added successfully',
            id: Number(result.lastInsertRowid)
        });
    } catch (error) {
        console.error('Add doctor error:', error);
        res.status(500).json({ error: 'Failed to add doctor' });
    }
});

// Delete doctor
app.delete('/api/admin/doctors/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM doctors WHERE id = ?',
            args: [req.params.id]
        });
        res.json({ success: true, message: 'Doctor deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete doctor' });
    }
});

// Edit doctor
app.put('/api/admin/doctors/:id', async (req, res) => {
    try {
        const { name, email, department, phone, password } = req.body;
        const doctorId = req.params.id;

        if (!name || !email || !department) {
            return res.status(400).json({ error: 'Name, email, and department are required' });
        }

        // Check if email is used by another doctor
        const existing = await db.execute({
            sql: 'SELECT id FROM doctors WHERE email = ? AND id != ?',
            args: [email, doctorId]
        });

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already used by another doctor' });
        }

        // If password is provided, update it too
        if (password && password.trim() !== '') {
            const hashedPassword = bcrypt.hashSync(password, 10);
            await db.execute({
                sql: 'UPDATE doctors SET name = ?, email = ?, department = ?, phone = ?, password = ? WHERE id = ?',
                args: [name, email, department, phone || '', hashedPassword, doctorId]
            });
        } else {
            await db.execute({
                sql: 'UPDATE doctors SET name = ?, email = ?, department = ?, phone = ? WHERE id = ?',
                args: [name, email, department, phone || '', doctorId]
            });
        }

        res.json({ success: true, message: 'Doctor updated successfully' });
    } catch (error) {
        console.error('Edit doctor error:', error);
        res.status(500).json({ error: 'Failed to update doctor' });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   HealthPlus Clinic Backend Server                         ║
║   Running at: http://localhost:${PORT}                        ║
╠════════════════════════════════════════════════════════════╣
║   Frontend served from /public                             ║
║   Backend APIs active                                      ║
║   Database: Turso Cloud                                    ║
║   Email OTP: Resend                                        ║
╚════════════════════════════════════════════════════════════╝
    `);
});
