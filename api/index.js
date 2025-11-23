// api/index.js

// This file is the Vercel Serverless Function entry point.
// It imports and exports the main Express app instance.

// Adjust the path below if your main server file is not in a 'server' directory.
// For example, if your main file is in the root, use: const app = require('../index'); 
const app = require('../server/index'); 

module.exports = app;