const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const marked = require('marked');
const Post = require('./post');
const Feedback = require('./models/feedback'); // NEW Import

const app = express();
const PORT = process.env.PORT || 3000; // Correct for Render

// --- CORS Configuration ---
const whitelist = [
    'https://peppy-klepon-999ed1.netlify.app',      // Your Netlify URL
    'https://www.lawwheelsservices.co.in',          // NEW: Your Custom Domain (www)
    'https://lawwheelsservices.co.in'               // NEW: Your Custom Domain (non-www)
];

const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions)); // Use the specific CORS options
// --- END CORS CONFIG ---

// Middleware
app.use(express.json());

// --- Cloudinary Config (Replaces local storage) ---
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'law-firm-blog',
    allowed_formats: ['jpg', 'jpeg', 'png']
  }
});
const upload = multer({ storage: storage }); 
// --- END Cloudinary Config ---

// Database Connection (Uses Render Environment Variable)
const dbURI = process.env.dbURI; 

mongoose.connect(dbURI)
  .then(() => {
    console.log('Successfully connected to MongoDB!');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  })
  .catch(err => console.log(err));

// Slugify Function
const slugify = text => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

// --- NEW: Feedback API ROUTES ---

// 1. POST Route: Receives and saves new feedback from the client form
app.post('/add-feedback', async (req, res) => {
    try {
        const newFeedback = new Feedback({
            clientName: req.body.clientName,
            address: req.body.address,
            occupation: req.body.occupation,
            serviceTaken: req.body.serviceTaken,
            feedbackContent: req.body.feedbackContent,
            isApproved: false // Saved as unapproved by default
        });

        const savedFeedback = await newFeedback.save();
        // Send a success message back to the client
        res.json({ message: 'Feedback submitted successfully. It will appear on the site after review.', data: savedFeedback });

    } catch (err) {
        res.status(400).json({ error: 'Failed to submit feedback. Please ensure all fields are filled.', details: err.message });
    }
});

// 2. GET Route: Fetches approved feedback for display on the public site
app.get('/testimonials', (req, res) => {
    // Only return feedback that has been marked as approved
    Feedback.find({ isApproved: true })
        .sort({ createdAt: -1 }) // Show newest first
        .then(feedback => res.json(feedback))
        .catch(err => res.status(400).json({ error: 'Could not fetch testimonials.', details: err.message }));
});

// --- END NEW: Feedback API ROUTES ---
// --- API ROUTES ---

// GET all posts
app.get('/posts', (req, res) => Post.find().sort({ createdAt: -1 }).then(posts => res.json(posts)).catch(err => res.status(400).json({ error: err.message })));

// GET posts by category (FIXED to handle hyphens and ampersands)
app.get('/posts/category/:name', (req, res) => {
  const categoryName = req.params.name.replace(/-/g, ' ').replace(/&/g, '&');
  Post.find({ category: { $regex: new RegExp(`^${categoryName}$`, "i") } }).sort({ createdAt: -1 }).then(posts => res.json(posts)).catch(err => res.status(400).json({ error: err.message }));
});

// GET a single post by slug
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

// POST a new post (Uses Cloudinary)
app.post('/add-post', upload.single('image'), async (req, res) => {
  try {
    const postSlug = `${slugify(req.body.title)}-${Date.now()}`;
    const newPost = new Post({
      title: req.body.title, 
      slug: postSlug, 
      content: req.body.content, 
      author: req.body.author, 
      category: req.body.category,
      imageUrl: req.file ? req.file.path : null // Saves the Cloudinary URL
    });
    const savedPost = await newPost.save();
    res.json(savedPost);
  } catch (err) {
    if (err.code === 11000) {
        return res.status(409).json({ message: 'A post with this title already exists. Kindly update the title.' });
    }
    res.status(400).json({ error: 'Error saving post', details: err });
  }
});

// DELETE a post by ID
app.delete('/posts/:id', (req, res) => Post.findByIdAndDelete(req.params.id).then(() => res.json({ message: 'Post deleted.' })).catch(err => res.status(400).json({ error: err.message })));

// Note: The extra '}' at the end has been removed.