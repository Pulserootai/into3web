const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // We have inline scripts/styles
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Gzip compression
app.use(compression());

// Cache static assets (images, fonts, scripts)
app.use(express.static(path.join(__dirname), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        // HTML files — no cache (always fresh)
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        // Images — cache aggressively
        if (/\.(png|jpg|jpeg|webp|svg|gif|ico)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
        }
        // JS/CSS — cache with revalidation
        if (/\.(js|css)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
        }
    }
}));

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle clean URLs (optional — /pricing → pricing.html)
app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    // Skip if it already has an extension
    if (path.extname(page)) return next();

    const filePath = path.join(__dirname, `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) next();
    });
});

// Handle blog clean URLs (/blog/article-name → blog/article-name.html)
app.get('/blog/:article', (req, res, next) => {
    const article = req.params.article;
    if (path.extname(article)) return next();

    const filePath = path.join(__dirname, 'blog', `${article}.html`);
    res.sendFile(filePath, (err) => {
        if (err) next();
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`into3.ai running on port ${PORT}`);
});
