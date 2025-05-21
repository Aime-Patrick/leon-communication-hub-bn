import mongoose from "mongoose"

export interface IPost {
  id: string;
  caption: string;
  media_type: string;
  media_url: string;
  timestamp: string;
}
const postSchema = new mongoose.Schema({
  id: String,
  caption: String,
  media_type: String,
  media_url: String,
  timestamp: String
});

export default mongoose.model<IPost>('Post', postSchema);