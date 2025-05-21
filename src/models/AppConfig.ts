import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
    logoUrl: {
        type: String,
        default: null
    },
    appName: {
        type: String,
        required: true
    },
    isSetupComplete: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

export const AppConfig = mongoose.model('AppConfig', appConfigSchema); 