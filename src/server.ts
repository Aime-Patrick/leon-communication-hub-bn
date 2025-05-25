import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app'; // Import your Express app instance from app.ts
import { connectDB } from './config/database'; // Import connectDB

dotenv.config();

const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ['http://localhost:5173','https://leon-fe.vercel.app', /\.ngrok-free\.app$/], // Ensure ngrok is allowed here too
    methods: ['GET', 'POST'],
    credentials: true,
  },
});


// Start the server
// Connect to DB *before* starting the server and mounting routes
connectDB()
  .then(() => {
    console.log('MongoDB connected successfully');
    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error: any) => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1); // Exit if DB connection fails
  });

export { io };
