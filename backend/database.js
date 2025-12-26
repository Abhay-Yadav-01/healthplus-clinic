const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// Create Turso database client
const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'libsql://healthplus-clinic-abhay-yadav-01.aws-ap-south-1.turso.io',
    authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjU3ODI2MjcsImlkIjoiOGQ2YzI4OWQtNmQ4Zi00OGQ2LWE4ZjYtYjA2NzgwMjYyNDZlIiwicmlkIjoiYWI1ZTA5NjgtZTQ3ZS00MGVmLWFiZTMtOWQyMThiZmU4NWFmIn0.Vy-b9zX7B_4t73zN02Ds3QWtMx28BROkDVOSlxNgwiG4lhx6rHPXs5gwavQ2tfOS7-kBL6x_d4uKUH3mdGvXBw'
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create tables
        await db.execute(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                subject TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_name TEXT NOT NULL,
                patient_phone TEXT NOT NULL,
                patient_email TEXT NOT NULL,
                patient_age INTEGER,
                patient_gender TEXT,
                department TEXT NOT NULL,
                doctor TEXT NOT NULL,
                appointment_date TEXT NOT NULL,
                appointment_time TEXT NOT NULL,
                consultation_type TEXT NOT NULL,
                symptoms TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                dob TEXT,
                gender TEXT,
                address TEXT,
                email_verified INTEGER DEFAULT 0,
                phone_verified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS otp_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identifier TEXT NOT NULL,
                otp_code TEXT NOT NULL,
                type TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                verified INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                department TEXT NOT NULL,
                phone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add missing columns to existing tables (for database migration)
        try {
            await db.execute('ALTER TABLE patients ADD COLUMN email_verified INTEGER DEFAULT 0');
            console.log('Added email_verified column to patients table');
        } catch (e) {
            // Column already exists, ignore error
        }

        try {
            await db.execute('ALTER TABLE patients ADD COLUMN phone_verified INTEGER DEFAULT 0');
            console.log('Added phone_verified column to patients table');
        } catch (e) {
            // Column already exists, ignore error
        }

        // Check and add doctors - insert any missing doctors
        const hashedPassword = bcrypt.hashSync('doctor123', 10);

        const doctors = [
            ['Dr. Pawan Pandey', 'pawan@healthplus.com', hashedPassword, 'General Medicine', '7052691142'],
            ['Dr. Anuradha', 'anuradha@healthplus.com', hashedPassword, 'Pediatrics', '7052691143'],
            ['Dr. Kaushal Kumar', 'kaushal@healthplus.com', hashedPassword, 'Cardiology', '7052691144'],
            ['Dr. Mudit Dubey', 'mudit@healthplus.com', hashedPassword, 'Dermatology', '7052691145'],
            ['Dr. Anupama Srivastva', 'anupama@healthplus.com', hashedPassword, 'Gynecology', '7052691146'],
            ['Dr. Abhay Yadav', 'abhay@healthplus.com', hashedPassword, 'Psychiatry', '7052691147'],
            ['Dr. Shahil Ansari', 'shahil@healthplus.com', hashedPassword, 'Neurology', '7052691148'],
            ['Dr. Priya Singh', 'priya@healthplus.com', hashedPassword, 'Ophthalmology', '7052691149'],
            ['Dr. Rajesh Verma', 'rajesh@healthplus.com', hashedPassword, 'Orthopedics', '7052691150'],
            ['Dr. Sunita Sharma', 'sunita@healthplus.com', hashedPassword, 'Dentistry', '7052691151'],
            ['Dr. Amit Gupta', 'amit@healthplus.com', hashedPassword, 'ENT', '7052691152'],
            ['Dr. Neha Agarwal', 'neha@healthplus.com', hashedPassword, 'Physiotherapy', '7052691153']
        ];

        for (const doc of doctors) {
            try {
                // Check if doctor already exists
                const existing = await db.execute({
                    sql: 'SELECT id FROM doctors WHERE email = ?',
                    args: [doc[1]]
                });

                if (existing.rows.length === 0) {
                    await db.execute({
                        sql: 'INSERT INTO doctors (name, email, password, department, phone) VALUES (?, ?, ?, ?, ?)',
                        args: doc
                    });
                    console.log(`Doctor ${doc[0]} added to database`);
                }
            } catch (e) {
                // Ignore if already exists
            }
        }
        console.log('All 12 doctors ensured in database with password: doctor123');

        console.log('Database initialized successfully!');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Initialize on startup
initializeDatabase();

module.exports = db;
