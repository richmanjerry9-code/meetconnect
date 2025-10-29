import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // store in .env.local
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send("Method not allowed");

  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ message: "Image URL required" });

  try {
    const response = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: `Check if this image contains nudity or sexually explicit content: ${imageUrl}`
    });

    const flagged = response.results[0].categories.sexual || false;

    if (flagged) {
      return res.status(200).json({
        accepted: false,
        message: "🚫 Nude photos are not accepted. Please upload a safe image."
      });
    }

    return res.status(200).json({
      accepted: true,
      message: "✅ Image accepted!"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ accepted: false, message: "Error checking image." });
  }
}
