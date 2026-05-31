const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbwTztGw-G9IMjWHTwbJK_Fv4SUJbdHeVAFPQnmqkxJks034SY2xBg0uonhY3nplqSfo/exec";

function tryParseGasJson(text) {
  if (!text) return null;

  const trimmed = text.trim().replace(/^\)\]\}'\s*/, "");

  try {
    return JSON.parse(trimmed);
  } catch (_err) {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (_err2) {
        return null;
      }
    }
    return null;
  }
}

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

  const parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const action = parsedBody.action;
  const payload = parsedBody.payload || {};

  if (!action) {
    res.status(400).json({ status: "error", message: "Missing action" });
    return;
  }

  const gasUrl = DEFAULT_GAS_URL;

  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: toFormBody(action, payload)
    });

    const text = await response.text();
    const parsed = tryParseGasJson(text);

    let data = parsed;
    if (!data) {
      const snippet = text.replace(/\s+/g, " ").slice(0, 300);
      const likelyHtml = /^\s*</.test(text);
      data = {
        status: "error",
        message: "Invalid GAS response",
        detail: likelyHtml
          ? "GAS merespons HTML (biasanya deployment/permission belum benar)."
          : "GAS merespons non-JSON.",
        rawSnippet: snippet
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

    if (!parsed) {
      res.status(502).json(data);
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
