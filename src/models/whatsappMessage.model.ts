import mongoose, { Document, Schema } from 'mongoose';

export interface IWhatsAppMessage extends Document {
  from: string;
  to?: string;
  type: 'incoming' | 'outgoing';
  message: string;
  timestamp: Date;
}

const WhatsAppMessageSchema = new Schema<IWhatsAppMessage>({
  from: { type: String, required: true },
  to: { type: String },
  type: { type: String, enum: ['incoming', 'outgoing'], required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<IWhatsAppMessage>('WhatsAppMessage', WhatsAppMessageSchema);
