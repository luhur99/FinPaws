const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwTztGw-G9IMjWHTwbJK_Fv4SUJbdHeVAFPQnmqkxJks034SY2xBg0uonhY3nplqSfo/exec";

function toFormBody(action, payload) {
  const params = new URLSearchParams();
  params.set("action", action);

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, String(value));
  });

  return params;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const action = req.body && req.body.action;
  const payload = (req.body && req.body.payload) || {};

  if (!action) {
    res.status(400).json({ status: "error", message: "Missing action" });
    return;
  }

  const gasUrl = process.env.GAS_URL || DEFAULT_GAS_URL;

  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: toFormBody(action, payload)
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      data = {
        status: "error",
        message: "Invalid GAS response",
        raw: text
      };
    }

    if (!response.ok) {
      res.status(502).json({
        status: "error",
        message: `GAS HTTP ${response.status}`,
        data
      });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Proxy request to GAS failed",
      detail: err.message
    });
  }
}
