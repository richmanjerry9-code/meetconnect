import axios from 'axios';

export const getAccessToken = async () => {
  const response = await axios.get(
    'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      auth: {
        username: 'E5qGq0Jms9DpRyxH5iVGN8ypxqWGMp3GHOiSJjrFG5IROjbu',
        password: 'mFApVxGGtVYXmECdXwxiFALK5jNgskLp2ROOjaaWFFeMJCqhbR5GWrtvaSqIUXdk',
      },
    }
  );
  return response.data.access_token;
};
