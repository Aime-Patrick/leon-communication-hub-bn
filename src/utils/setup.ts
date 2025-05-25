import { AppConfig } from '../models/AppConfig';
import { User } from '../models/User';


export const checkFirstTimeSetup = async (): Promise<boolean> => {
    try {
        const userCount = await User.countDocuments();
        
        // Check if app settings exist
        const appSettings = await AppConfig.findOne();
        
        // If no users and no app settings, this is first time setup
        return userCount === 0 && !appSettings;
    } catch (error) {
        console.error('Error checking first time setup:', error);
        // If there's an error (like database not initialized), treat as first time setup
        return true;
    }
}; 