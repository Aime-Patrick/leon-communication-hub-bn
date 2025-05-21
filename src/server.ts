import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import whatsappRoutes from './routes/whatsapp.route';
import facebookRoutes from './routes/facebook.route';
import gmailRoutes from './routes/gmail.route';
import authRoutes from './routes/auth.route';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';

dotenv.config();

const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Middleware
app.use(express.json());
app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));

// API routes
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/auth', authRoutes);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.send('Server is running!');
});

// Start the server
httpServer.listen(PORT, async () => {
  await connectDB();
  console.log(`Server is running on http://localhost:${PORT}`);
});

export { io };
