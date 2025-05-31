import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import setupRoutes from './routes/setup.route';
import authRoutes from './routes/auth.route';
import userRoutes from './routes/user.route';
import gmailRoutes from './routes/gmail.route';
import whatsappRoutes from './routes/whatsapp.route';
import facebookRoutes from './routes/facebook.route';
import appRoutes from './routes/app.route';
import { checkFirstTimeSetup } from './utils/setup';
import { connectDB } from './config/database';
import crypto from 'crypto';
import tiktokRoutes from './routes/tiktok.route'
import instagramRoutes from './routes/instagram.route'

interface SessionData {
    oauthState?: string;           // For OAuth flow
    facebookConnectUserId?: string; // User ID during Facebook connection
    userId?: string;               // Current user's ID
    loaded?: boolean;              // Whether session is loaded from store
}

declare module 'express-session' {
    interface SessionData {
        oauthState?: string;
        facebookConnectUserId?: string;
        userId?: string;
        loaded?: boolean;
    }
}

const app = express();

// CORS configuration
const allowedOrigins = [
    'http://localhost:5173', // Vite dev server
    'https://leon-fe.vercel.app', // Vercel frontend
    /\.ngrok-free\.app$/, // Your ngrok URL
    process.env.FRONTEND_URL // Production URL
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'ngrok-skip-browser-warning'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "fallback_secret",
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI_DEV,
        ttl: 24 * 60 * 60,
        autoRemove: 'native',
        touchAfter: 0,
        collectionName: 'sessions',
        stringify: false,
        crypto: {
            secret: process.env.SESSION_SECRET
        }
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
    },
    name: 'connect.sid',
    rolling: true,
    proxy: true,
    genid: (req) => {
        // Generate a consistent session ID based on the user's IP and user agent
        const userAgent = req.headers['user-agent'] || '';
        const ip = req.ip || req.connection.remoteAddress || '';
        return crypto.createHash('sha256').update(`${ip}${userAgent}`).digest('hex');
    }
}));

// Add session debugging middleware
app.use((req, res, next) => {
    // Ensure session is loaded from store
    if (req.session && !req.session.loaded) {
        req.session.reload((err) => {
            if (err) {
                console.error('Error reloading session:', err);
            }
        });
    }

    console.log('Session Debug:', {
        sessionId: req.sessionID,
        cookie: req.session.cookie,
        sessionData: req.session,
        headers: {
            cookie: req.headers.cookie,
            origin: req.headers.origin,
            referer: req.headers.referer,
            userAgent: req.headers['user-agent']
        }
    });

    // Ensure session is saved after each request
    res.on('finish', () => {
        if (req.session && req.session.save) {
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session after response:', err);
                }
            });
        }
    });

    next();
});

// Initialize database connection
connectDB()
    .then(async () => {
        // Always mount setup routes first
        app.use('/api/setup', setupRoutes);
        // Mount app routes (these should be available regardless of setup status)
        app.use('/api/app', appRoutes);
        // Always mount auth routes
        app.use('/api/auth', authRoutes);
        // Always mount Gmail routes
        app.use('/api/gmail', gmailRoutes);

        // Check if this is first time setup
        const isFirstTimeSetup = await checkFirstTimeSetup();

        // Mount other routes only if setup is complete
        if (!isFirstTimeSetup) {
            app.use('/api/whatsapp', whatsappRoutes);
            app.use('/api/facebook', facebookRoutes);
            app.use('/api/user', userRoutes);
            app.use('/api/tiktok',tiktokRoutes)
            app.use('/api/instagram', instagramRoutes);
        }
    })
    .catch((error: any) => {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    });

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

export default app; 