import axios from 'axios';
import { BASE_URL } from '../utils/mpesa'; // Import dynamic BASE_URL

export const getAccessToken = async () => {
  const OAUTH_URL = `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`;
  const response = await axios.get(OAUTH_URL, {
    auth: {
      username: process.env.MPESA_CONSUMER_KEY,
      password: process.env.MPESA_CONSUMER_SECRET,
    },
  });
  return response.data.access_token;
};