import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { verifyToken } from "../utils/auth";
import crypto from "crypto";

// In-memory storage for OAuth states
const oauthStates = new Map<string, { state: string; userId: string; timestamp: number }>();

// Clean up old states every hour
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, value] of oauthStates.entries()) {
        if (value.timestamp < oneHourAgo) {
            oauthStates.delete(key);
        }
    }
}, 3600000);

export interface AuthRequest extends Request {
    user?: any;
    session: any;
}

export const protect = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({ error: "No token, authorization denied" });
            return;
        }

        const token = authHeader.split(" ")[1];
        // Verify token
        const user: any = await verifyToken(token);
        if (!user) {
            res.status(401).json({ error: "User not found" });
            return;
        }

        // Attach user to request
        req.user = user;

        // Handle session state for OAuth routes
        if (req.path.includes('/auth/login') || req.path.includes('/auth/callback')) {
            // For login route, generate and set new state
            if (req.path.includes('/auth/login')) {
                const state = crypto.randomBytes(16).toString("hex");
                console.log('Setting OAuth State in session:', {
                    state,
                    userId: user._id,
                    path: req.path,
                    sessionId: req.sessionID
                });

                // Set session data
                req.session.oauthState = state;
                req.session.facebookConnectUserId = user._id.toString();
                req.session.userId = user._id.toString();

                // Save session changes
                await new Promise<void>((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) {
                            console.error('Error saving session in protect middleware:', err);
                            reject(err);
                            return;
                        }
                        console.log('Session saved in protect middleware:', {
                            sessionId: req.sessionID,
                            state: req.session.oauthState,
                            userId: req.session.userId
                        });
                        resolve();
                    });
                });
            }

            // For callback route, verify session exists
            if (req.path.includes('/auth/callback')) {
                console.log('Verifying session in callback:', {
                    sessionId: req.sessionID,
                    state: req.session.oauthState,
                    userId: req.session.userId
                });

                if (!req.session.oauthState || !req.session.userId) {
                    console.error('Missing session data in callback');
                    res.status(401).json({
                        error: 'Session Error',
                        message: 'Missing session data. Please try logging in again.'
                    });
                    return;
                }
            }
        }

        next();
    } catch (error) {
        console.error('Protect middleware error:', error);
        res.status(401).json({ error: "Token is not valid" });
    }
};

// Helper function to verify OAuth state
export const verifyOAuthState = (state: string): { userId: string } | null => {
    const stateData = oauthStates.get(state);
    if (!stateData) return null;
    
    // Remove the state after verification
    oauthStates.delete(state);
    return { userId: stateData.userId };
};

export const admin = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (req.user?.role !== "ADMIN") {
        res.status(403).json({ error: "Access denied" });
        return;
    }
    next();
};

export const user = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    if (req.user?.role !== "USER") {
        res.status(403).json({ error: "Access denied" });
        return;
    }
    next();
};

export const auth = {
    protect,
    admin: [protect, admin],
    user: [protect, user],
    any: [protect],
};
