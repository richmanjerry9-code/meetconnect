import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload error" });

    const imagePath = files.file[0].filepath;
    const imageBuffer = fs.readFileSync(imagePath);

    try {
      const moderation = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: [{ image: imageBuffer }],
      });

      const result = moderation.results[0];

      // 👇 SOFTER FILTER — rejects only clear nudity or sexual content
      if (result.categories.sexual || result.categories.sexual_minors) {
        return res.status(400).json({
          accepted: false,
          reason: "🚫 Nude or sexually explicit images are not allowed.",
        });
      }

      // ✅ Accept all other images
      return res.status(200).json({ accepted: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Moderation check failed" });
    }
  });
}
