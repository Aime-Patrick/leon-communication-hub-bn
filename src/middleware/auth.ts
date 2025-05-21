import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { verifyToken } from '../utils/auth';

interface AuthRequest extends Request {
    user?: any;
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token, authorization denied' });
            return;
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded: any = verifyToken(token);

        // Find user
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

export const admin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    next();
};

export const user = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.user?.role !== 'USER') {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    next();
};

export const auth = {
    protect,
    admin: [protect, admin],
    user: [protect, user],
    any: [protect]
}; 