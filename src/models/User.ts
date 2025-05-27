import mongoose, { Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    profilePicture: string;
    role: 'ADMIN' | 'USER';
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    isFirstLogin: boolean;
    gmailRefreshToken?: string;
    gmailAccessToken?: string;
    gmailAccessTokenExpires?: Date;

    // --- NEW FACEBOOK FIELDS ---
    facebookAccessToken?: string;
    facebookAccessTokenExpires?: Date;
    facebookAdAccountId?: string; // The ID of the ad account the user wants to manage (e.g., 'act_12345')
    facebookBusinessId?: string;  // The ID of the business account the user wants to manage
    // If you plan to manage multiple pages per user, consider a separate 'Page' model
    // For simplicity, if a user primarily manages one page for marketing, you could store it here:
    facebookPageId?: string;      // The ID of a primary Facebook Page
    facebookPageAccessToken?: string; // The access token for the primary Facebook Page

    // --- NEW TIKTOK FIELDS ---
    tiktok?: {
        id: string;
        accessToken: string;
        refreshToken: string;
        expiresAt: Date;
    };

    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['ADMIN', 'USER'],
        default: 'USER'
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    isFirstLogin: {
        type: Boolean,
        default: true
    },
    gmailRefreshToken: String,
    gmailAccessToken: String,
    gmailAccessTokenExpires: Date,

    // --- NEW FACEBOOK SCHEMA FIELDS ---
    facebookAccessToken: {
        type: String,
        required: false // Not required until user connects Facebook
    },
    facebookAccessTokenExpires: {
        type: Date,
        required: false
    },
    facebookAdAccountId: {
        type: String,
        required: false
    },
    facebookBusinessId: {
        type: String,
        required: false
    },
    facebookPageId: {
        type: String,
        required: false
    },
    facebookPageAccessToken: {
        type: String,
        required: false
    },

    // --- NEW TIKTOK SCHEMA FIELDS ---
    tiktok: {
        id: {
            type: String,
            required: false
        },
        accessToken: {
            type: String,
            required: false
        },
        refreshToken: {
            type: String,
            required: false
        },
        expiresAt: {
            type: Date,
            required: false
        }
    }
}, {
    timestamps: true,
    toJSON: {
        transform: (_doc, ret) => {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            delete ret.password; // Always omit password from JSON output
            // Optionally omit tokens from JSON output for security, unless explicitly needed client-side
            delete ret.facebookAccessToken;
            delete ret.facebookAccessTokenExpires;
            delete ret.gmailRefreshToken;
            delete ret.gmailAccessToken;
            delete ret.gmailAccessTokenExpires;
            delete ret.tiktok?.accessToken;
            delete ret.tiktok?.refreshToken;
            delete ret.tiktok?.expiresAt;
            return ret;
        }
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

export const User = mongoose.model<IUser>('User', userSchema);
