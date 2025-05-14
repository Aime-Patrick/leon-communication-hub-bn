import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import whatsappRoutes from './routes/whatsapp.route';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(morgan(
    process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));
app.use('/api/whatsapp', whatsappRoutes);

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('Server is running!');
});

// Start the server
app.listen(PORT, async() => {
    await connectDB();
  console.log(`Server is running on http://localhost:${PORT}`);
});