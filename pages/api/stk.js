export default async function handler(req, res) {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return res.status(500).json({ error: "MPESA env variables are missing" });
  }

  res.status(200).json({ message: "MPESA keys loaded successfully ✅" });
}
