import { IUser } from '../models/User';
import { Session, SessionData } from 'express-session';

declare global {
    namespace Express {
        // Extend the Session interface from express-session
        interface Session extends Session {
            oauthState?: string;
            facebookConnectUserId?: string;
            userId?: string;
            user?: IUser;
        }

        // Extend the Request interface
        interface Request {
            user?: IUser;
            facebookService?: any;
            session: Session & Partial<SessionData>;
        }
    }
}

export {}; 