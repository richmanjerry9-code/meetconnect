import axios from 'axios';

export const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa consumer key/secret not set in environment variables');
  }

  const response = await axios.get(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      auth: {
        username: consumerKey,
        password: consumerSecret,
      },
    }
  );

  if (!response.data?.access_token) {
    throw new Error('Failed to get M-Pesa access token');
  }

  return response.data.access_token;
};

