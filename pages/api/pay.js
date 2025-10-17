import stkPushHandler from "@/mpesa-api/stkPush";

export default async function handler(req, res) {
  return stkPushHandler(req, res);
}


