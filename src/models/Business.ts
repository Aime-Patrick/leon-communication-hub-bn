import mongoose, { Document, Schema } from 'mongoose';

export interface IBusiness extends Document {
    facebookUserId: string;
    businessId: string;
    name: string;
    adAccounts: Array<{
        id: string;
        name: string;
        account_status: number;
        currency: string;
        timezone_name: string;
        business?: {
            id: string;
            name: string;
        };
        owner?: {
            id: string;
            name: string;
        };
        account_id: string;
        balance: string;
        spend_cap: string;
        amount_spent: string;
    }>;
    lastUpdated: Date;
}

const BusinessSchema = new Schema({
    facebookUserId: {
        type: String,
        required: true
    },
    businessId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    adAccounts: [{
        id: String,
        name: String,
        account_status: Number,
        currency: String,
        timezone_name: String,
        business: {
            id: String,
            name: String
        },
        owner: {
            id: String,
            name: String
        },
        account_id: String,
        balance: String,
        spend_cap: String,
        amount_spent: String
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Create a compound index on facebookUserId and businessId
BusinessSchema.index({ facebookUserId: 1, businessId: 1 }, { unique: true });

export const Business = mongoose.model<IBusiness>('Business', BusinessSchema); 