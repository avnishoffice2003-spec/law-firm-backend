const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const marked = require('marked');
const Post = require('./post');
const Feedback = require('./models/feedback'); // NEW: Import the Feedback model

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS Configuration ---
const whitelist = [
    'https://peppy-klepon-999ed1.netlify.app',      // Your Netlify URL
    'https://www.lawwheelsservices.co.in',          // Your Custom Domain (www)
    'https://lawwheelsservices.co.in'               // Your Custom Domain (non-www)
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

app.use(cors(corsOptions));
app.use(express.json());

// --- Cloudinary Config ---
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

// Database Connection
const dbURI = process.env.dbURI; 

mongoose.connect(dbURI)
  .then(() => {
    console.log('Successfully connected to MongoDB!');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  })
  .catch(err => console.log(err));

// Slugify Function
const slugify = text => text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');


// ==========================================
//              BLOG ROUTES
// ==========================================

// GET all posts
app.get('/posts', (req, res) => Post.find().sort({ createdAt: -1 }).then(posts => res.json(posts)).catch(err => res.status(400).json({ error: err.message })));

// GET posts by category
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

// POST a new blog post
app.post('/add-post', upload.single('image'), async (req, res) => {
  try {
    const postSlug = `${slugify(req.body.title)}-${Date.now()}`;
    const newPost = new Post({
      title: req.body.title, 
      slug: postSlug, 
      content: req.body.content, 
      author: req.body.author, 
      category: req.body.category,
      imageUrl: req.file ? req.file.path : null 
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

// DELETE a blog post
app.delete('/posts/:id', (req, res) => Post.findByIdAndDelete(req.params.id).then(() => res.json({ message: 'Post deleted.' })).catch(err => res.status(400).json({ error: err.message })));


// ==========================================
//           FEEDBACK / TESTIMONIAL ROUTES
// ==========================================

// 1. PUBLIC: Submit new feedback (Saved as 'Unapproved' by default)
app.post('/add-feedback', async (req, res) => {
    try {
        const newFeedback = new Feedback({
            clientName: req.body.clientName,
            address: req.body.address,
            occupation: req.body.occupation,
            serviceTaken: req.body.serviceTaken,
            feedbackContent: req.body.feedbackContent,
            isApproved: false 
        });
        const savedFeedback = await newFeedback.save();
        res.json({ message: 'Feedback submitted successfully.' });
    } catch (err) {
        res.status(400).json({ error: 'Failed to submit feedback.', details: err.message });
    }
});

// 2. PUBLIC: Get ONLY approved testimonials (For the website)
app.get('/testimonials', (req, res) => {
    Feedback.find({ isApproved: true }).sort({ createdAt: -1 })
        .then(feedback => res.json(feedback))
        .catch(err => res.status(400).json({ error: 'Could not fetch testimonials.' }));
});

// 3. ADMIN: Get ALL pending (unapproved) feedback
app.get('/feedback/pending', (req, res) => {
    Feedback.find({ isApproved: false }).sort({ createdAt: -1 })
        .then(feedback => res.json(feedback))
        .catch(err => res.status(400).json({ error: 'Could not fetch pending feedback.' }));
});

// 4. ADMIN: Approve a feedback item
app.put('/feedback/approve/:id', (req, res) => {
    Feedback.findByIdAndUpdate(req.params.id, { isApproved: true })
        .then(() => res.json({ message: 'Feedback approved.' }))
        .catch(err => res.status(400).json({ error: 'Could not approve feedback.' }));
});

// 5. ADMIN: Delete a feedback item
app.delete('/feedback/:id', (req, res) => {
    Feedback.findByIdAndDelete(req.params.id)
        .then(() => res.json({ message: 'Feedback deleted.' }))
        .catch(err => res.status(400).json({ error: 'Could not delete feedback.' }));
});