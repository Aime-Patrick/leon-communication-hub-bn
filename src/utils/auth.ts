import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { Types } from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

interface TokenPayload {
    id: string;
    email: string;
    role: string;
}

interface ResetTokenPayload {
    email: string;
    type: 'reset';
}

export const generateToken = (user: IUser): string => {
    // Convert Mongoose document to plain object and ensure _id is string
    const userObj = user.toObject();
    const payload: TokenPayload = {
        id: userObj._id.toString(),
        email: userObj.email,
        role: userObj.role
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
};

export const generateResetToken = (email: string): string => {
    const payload: ResetTokenPayload = {
        email,
        type: 'reset'
    };
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
};

export const verifyToken = async (token: string): Promise<IUser | null> => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        const user = await User.findById(decoded.id);
        return user;
    } catch (error) {
        return null;
    }
};

export const verifyResetToken = async (token: string): Promise<string | null> => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as ResetTokenPayload;
        if (decoded.type !== 'reset') {
            return null;
        }
        return decoded.email;
    } catch (error) {
        return null;
    }
};

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }

        const user = await verifyToken(token);
        if (!user) {
            res.status(401).json({ message: 'Not authorized' });
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Not authorized' });
    }
};

export const admin = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ message: 'Not authorized as admin' });
        return;
    }
    next();
};

export const user = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== 'USER') {
        res.status(403).json({ message: 'Not authorized as user' });
        return;
    }
    next();
};

export const any = (req: Request, res: Response, next: NextFunction): void => {
    next();
};

export const auth = {
    protect,
    admin: [protect, admin],
    user: [protect, user],
    any: [protect]
};

export const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
}; 