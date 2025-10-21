const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String, required: true },
  imageUrl: { type: String }
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);
module.exports = Post;