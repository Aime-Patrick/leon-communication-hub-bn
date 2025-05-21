import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.route';
import gmailRoutes from './routes/gmail.route';
import setupRoutes from './routes/setup.route';
import appRoutes from './routes/app.route';

const app = express();

// CORS configuration
const allowedOrigins = [
    'http://localhost:5173', // Vite dev server
    'https://8586-197-157-145-210.ngrok-free.app', // Your ngrok URL
    process.env.FRONTEND_URL // Production URL
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/app', appRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        details: err.message
    });
});

export default app; 