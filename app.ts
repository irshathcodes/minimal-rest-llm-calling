const API_KEY = process.env.LLM_API_KEY;

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const res = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-goog-api-key": API_KEY,
  },
  body: JSON.stringify({
    contents: [
      {
        parts: [
          {
            text: "Explain calling an API in LLM workflow works",
          },
        ],
      },
    ],
  }),
});

const data = await res.text();
console.log(data);
