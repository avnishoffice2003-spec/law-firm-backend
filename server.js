const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const marked = require('marked'); // Make sure marked is included
const Post = require('./post');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Setup
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

// Database Connection
const dbURI = 'mongodb+srv://blogUser:Avnish123@cluster0.1wqmx9w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(dbURI)
  .then(() => {
    console.log('Successfully connected to MongoDB!');
    app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
  })
  .catch(err => console.log(err));

// Slugify Function
const slugify = text => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

// --- API ROUTES ---

// **THIS IS THE CRUCIAL ROUTE FOR GETTING ALL POSTS**
app.get('/posts', (req, res) => {
  Post.find().sort({ createdAt: -1 })
    .then(posts => res.json(posts)) // Sends the list of posts as JSON
    .catch(err => res.status(400).json({ error: err.message }));
});

// GET a single post by slug (using Markdown)
app.get('/posts/:slug', (req, res) => {
  Post.findOne({ slug: req.params.slug })
    .then(post => {
      if (post) {
        const processedPost = { ...post.toObject(), content: marked.parse(post.content) };
        res.json(processedPost);
      } else {
        res.status(404).json({ error: 'Post not found' });
      }
    })
    .catch(err => res.status(400).json({ error: err.message }));
});

// POST a new post (with slug and image)
app.post('/add-post', upload.single('image'), async (req, res) => {
  try {
    const postSlug = `${slugify(req.body.title)}-${Date.now()}`;
    const newPost = new Post({
      title: req.body.title, slug: postSlug, content: req.body.content, author: req.body.author, category: req.body.category,
      imageUrl: req.file ? `uploads/${req.file.filename}` : null
    });
    const savedPost = await newPost.save();
    res.json(savedPost);
  } catch (err) {
    // Check for duplicate slug error (code 11000)
    if (err.code === 11000) {
        return res.status(409).json({ message: 'A post with this title already exists. Kindly update the title.' });
    }
    res.status(400).json({ error: 'Error saving post', details: err });
  }
});

// DELETE a post by ID
app.delete('/posts/:id', (req, res) => {
  Post.findByIdAndDelete(req.params.id)
    .then(() => res.json({ message: 'Post deleted.' }))
    .catch(err => res.status(400).json({ error: err.message }));
});