import mongoose, { Schema, Document } from 'mongoose';

export interface IEmail extends Document {
    messageId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    timestamp: Date;
    labels: string[];
    isRead: boolean;
}

const EmailSchema: Schema = new Schema({
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    labels: [{
        type: String
    }],
    isRead: {
        type: Boolean,
        default: false
    }
});

export const Email = mongoose.model<IEmail>('Email', EmailSchema); 