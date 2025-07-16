// File: /api/counter.js

// This line imports the Vercel KV database helper
import { kv } from '@vercel/kv';

// This is the main serverless function. Vercel will automatically
// turn this file into an API endpoint at /api/counter
export default async function handler(request, response) {
  try {
    // This command increments the value of the 'visitor-count' key in your database.
    // If the key doesn't exist, it creates it with a value of 1.
    const count = await kv.incr('visitor-count');

    // Allow requests from any origin (CORS)
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send the new count back as a successful JSON response
    return response.status(200).json({ count: count });

  } catch (error) {
    // If there's an error (e.g., the database isn't connected), log it
    // and send back an error message.
    console.error('Error with KV store:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
