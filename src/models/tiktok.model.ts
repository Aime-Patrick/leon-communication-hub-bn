import mongoose from 'mongoose';

const tiktokTokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

export const TikTokToken = mongoose.model('TikTokToken', tiktokTokenSchema); 