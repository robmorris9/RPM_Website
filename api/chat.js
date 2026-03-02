export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Grab the data sent from your frontend
    const { systemInstruction, contents } = req.body;
    
    // Pull the API key from Vercel's secure environment variables
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('API key is missing from environment variables.');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Make the request to Google Gemini from the Vercel server
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction,
        contents
      })
    });

    // If Google's API rejects it (e.g., out of quota), throw an error so the frontend fallback kicks in
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      throw new Error('Failed to fetch from Gemini');
    }

    // Send the successful response back to your frontend HTML
    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Chat Endpoint Error:', error);
    // Returning a 500 error will trigger the funny progressive fallbacks in your HTML
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
