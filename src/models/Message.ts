import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
    messageId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    timestamp: Date;
    labels: string[];
    isRead: boolean;
    status: 'sent'| 'delivered'| 'read';
    type : 'incoming'| 'outgoing';
}

const MessageSchema: Schema = new Schema({
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    from: {
        type: String,
        required: true,
        index: true
    },
    to: {
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
    type: {
        type: String,
        enum: ['incoming', 'outgoing'],
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    }
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema); 