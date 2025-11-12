export async function POST(req) {
  const data = await req.json();
  console.log('Callback data:', JSON.stringify(data, null, 2));
  return new Response('ok');
}
